const recaptcha2 = require('recaptcha2')
const is = require('is-html');

const { server: { id }, bot_options: {
    max_owners_count,
    max_bot_tags,
    bot_tags,
    max_summary_length,
    min_description_length,
    max_description_length
}, web: { recaptcha_v2: { site_key, secret_key } } } = require("@root/config.json");

const recaptcha = new recaptcha2({
    siteKey: site_key,
    secretKey: secret_key
})

function isValidUrl(string) {
    try { new URL(string); } 
    catch (_) { return false; }
    return true;
}

module.exports = async (req, b = null) => {
    let data = req.body;

    // User hasn't submitted a captcha
    if (!data.recaptcha_token)
        return { success: false, message: "Captcha inválido" }

    // Validate captcha
    try {
        await recaptcha.validate(data.recaptcha_token)
    } catch (e) {
        return { success: false, message: "Captcha inválido" }
    }

    // Check that all the fields are filled in
    if (!data.long.length || !data.description.length || !data.prefix.length)
        return { success: false, message: "Envio inválido. Verifique se você preencheu todos os campos." }
    
    // Max length for summary and note
    if (data.description.length > max_summary_length) return { success: false, message: "Sua descrição curta é muito longa" };
    if (String(data.note).length > max_summary_length) return { success: false, message: "Sua nota para os verificadores é muito longa" };

    // Check if summary or note has HTML.
    if (is(data.description))
        return { success: false, message: "HTML não é suportado na descrição curta" }
    if (is(data.note))
        return { success: false, message: "HTML não é suportado na nota para os verificadores" }

    // Check that the bot's HTML description isn't too long
    let stripped = data.long.replace("/<[^>]*>/g")
    if (stripped.length < min_description_length)
        return { success: false, message: "O HTML da descrição é muito curto" }
    if (stripped.length > max_description_length)
        return { success: false, message: "O HTML da descrição é muito longo" }
    
    // Check that all the links are valid
    if (data.invite && !isValidUrl(data.invite)) 
        return { success: false, message: "invite inválido" }
    if (data.support && !isValidUrl(data.support)) 
        return { success: false, message: "servidor de suporte inválido" }
    if (data.website && !isValidUrl(data.website))
        return { success: false, message: "website inválido" }
    if (data.github && !isValidUrl(data.github))
        return { success: false, message: "Github repository inválido" }
    if (data.webhook && !isValidUrl(data.webhook))
        return { success: false, message: "webhook URL inválido" }

    // Check bot tags are valid
    if (data.tags) {
        if (!Array.isArray(data.tags))
            return { success: false, message: "bot tags inválido" }
        if (data.tags.length > max_bot_tags)
            return { success: false, message: `Selecione até ${max_bot_tags} tags no máximo.` }
        if (!data.tags.every(val => bot_tags.includes(val)))
            return { success: false, message: `tag(s) inválida(s)` }
    }
    
    // Check the user is in the main server.
    try {
        await req.app.get('client').guilds.cache.get(id).members.fetch(req.user.id);
    } catch (e) {
        return { success: false, message: "Você não está no servidor", button: { text: "Join", url: "/join" } }

    }
    // Search for a user with discord
    let bot;
    try {
        bot = await req.app.get('client').users.fetch(req.params.id)
        if (!bot.bot)
            return { success: false, message: "ID inválido. O usuário não é um bot" }
    } catch (e) {
        // Invalid bot ID
        if (e.message.endsWith("is not snowflake.") || e.message == "Unknown User")
            return { success: false, message: "O ID que indicou não é válido" }
        else
            return { success: false, message: "Não foi possivel encontrar o bot" }
    }

    /* 
        Check that the user signed is either:
        - The primary owner
        - An additional owner
        - A server admin
    */
    if (
        b &&
        b.owners.primary !== req.user.id &&
        !b.owners.additional.includes(req.user.id) &&
        !req.user.staff
    )
        return { success: false, message: "Pedido inválido. Faça login novamente.", button: { text: "Logout", url: "/logout" } }

    // If the additional owners have been changed, check that the primary owner is editing it
    if (
        b &&
        data.owners.replace(',', '').split(' ').remove('').join() !== b.owners.additional.join() &&
        b.owners.primary !== req.user.id
    )
        return { success: false, message: "Somente o proprietário principal pode editar proprietários adicionais" };
  
    let users = []
    if (data.owners) 
        users = data.owners.replace(',', '').split(' ').remove('').filter(id => /[0-9]{16,20}/g.test(id))

    try {
        /* 
            Filter owners:
            - Is in the server
            - Is not a bot user
            - Is not duplicate
        */
        users = await req.app.get('client').guilds.cache.get(id).members.fetch({ user: users });
        users = [...new Set(users.map(x => { return x.user }).filter(user => !user.bot).map(u => u.id))];

        // Check if additional owners exceed max
        if (users.length > max_owners_count)
            return { success: false, message: `Você só pode adicionar até ${max_owners_count} outros donos.` };

        return { success: true, bot, users }
    } catch (e) {
        return { success: false, message: "IDs de proprietário inválidos" };
    }
}
