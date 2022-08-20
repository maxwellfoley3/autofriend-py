const config = require('./config.js');
const { ETwitterStreamEvent, TwitterApi } = require('twitter-api-v2');
const Bot = require('./bot/bot.js')


const bots = [ 
	new Bot('automilady', 'curie:ft-personal:milady-prompts-fixed-2022-08-19-21-58-44', 1000 * 60 * 60 * 3),	
	new Bot('angelicism_bk', 'curie:ft-personal:angelicism-2022-08-18-22-45-06', 1000 * 60 * 60 * 3),	
	new Bot('lindycannibal','curie:ft-personal:frogtwitter-2022-08-19-15-37-55', 1000 * 60 * 4),
	new Bot('gatheringness','curie:ft-personal:hivemind-2022-08-19-21-28-10', 1000 * 60 * 60 * 2)
]

for (bot of bots) {
	bot.start()
}

 
const twitterClientAppAuth = new TwitterApi(config.twitter.bearer_token)

async function startStream() {
	try {
		// Delete old rules
		const rules = await twitterClientAppAuth.v2.streamRules();
		if (rules.data && rules.data.length) {
			await twitterClientAppAuth.v2.updateStreamRules({
				delete: { ids: rules.data.map(rule => rule.id) },
			});
		}

		await twitterClientAppAuth.v2.updateStreamRules({
			add: bots.map(bot => ({ value: `to:${bot.name}`, tag: `to:${bot.name}` }) ),
		})

		const stream = await twitterClientAppAuth.v2.searchStream({
			'tweet.fields': ['referenced_tweets', 'author_id'],
			expansions: ['referenced_tweets.id'],
		})

		console.log('Stream started')

		stream.autoReconnect = true;

		stream.on(ETwitterStreamEvent.Data, async tweet => {
			console.log("Found tweet to reply to", tweet)	
			for (rule of tweet.matching_rules) {
				if (rule.tag.startsWith('to:')) {
					const bot = bots.find(bot => bot.name === rule.tag.substring(3))
					if (bot) {
						await bot.reply(tweet.data.text, tweet.data.id)
					}
				}
			}
		})
	} catch (e) {
		console.log(e);
	}
}

startStream()