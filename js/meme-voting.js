const util = require('./util');
const db = require('./mongo-db');
const achievements = require('./achievements');
const vote_types = require('../config/vote-types.json');

const vote_prefix = "vote"

/**
 * Saves the user, his upvote and updates the upvote count.
 * @param {The context of the callback_query} ctx 
 */
async function handle_vote_request(ctx) {
    const file_id = util.any_media_id(ctx.update.callback_query.message);
    const user = ctx.update.callback_query.from;
    const vote_type = vote_type_from_callback_data(ctx.update.callback_query.data);

    if (!vote_types.find(t => t.id == vote_type)) {
        console.log("Unknown vote type:");
        console.log(vote_type);
        return;
    }

    await db.connected;
    db.save_user(ctx.update.callback_query.from);

    try {
        await db.save_vote(user.id, file_id, vote_type)

        setTimeout(() => achievements.check_vote_achievements(ctx, file_id, vote_type), 200);

        const votes = await db.count_votes(file_id);
        
        ctx.editMessageReplyMarkup({ inline_keyboard: create_keyboard(votes) })
            .catch(err => console.log(`ERROR: Could not update vote count (${err})`));
        ctx.answerCbQuery();
    }
    catch(err) {
        console.log(`ERROR: Vote handling failed:`);
        console.log(err);
        ctx.answerCbQuery();
    }
    
}

async function handle_legacy_like_request(ctx) {
    ctx.update.callback_query.data = "vote:like";
    return handle_vote_request(ctx);
}

function vote_type_from_callback_data(data) {
    return data.split(':', 2)[1];
}

function create_keyboard(votes) {
    let keyboard = []
    for (const type of vote_types) {
        keyboard.push({
            text: !!votes[type.id] ? `${type.emoji} - ${votes[type.id]}` : type.emoji,
            callback_data: `${vote_prefix}:${type.id}`
        });
    }
    return [keyboard];
}

function is_vote_callback(callback_query) {
    return callback_query.data.startsWith(`${vote_prefix}:`);
}

function is_legacy_like_callback(callback_query) {
    return callback_query.data == "upvote";
}

module.exports.handle_vote_request = handle_vote_request;
module.exports.handle_legacy_like_request = handle_legacy_like_request;
module.exports.create_keyboard = create_keyboard;
module.exports.is_vote_callback = is_vote_callback;
module.exports.is_legacy_like_callback = is_legacy_like_callback;
