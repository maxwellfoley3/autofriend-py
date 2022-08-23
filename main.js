const { ETwitterStreamEvent, TwitterApi } = require('twitter-api-v2')
const Bot = require('./bot/twitter-bot.js')
const HivemindBot = require('./bot/hivemind-bot.js')
const DiscordBot = require('./bot/discord-bot.js')
const DiscordHivemindBot = require('./bot/discord-hivemind-bot.js')
require('dotenv').config()
const { MongoClient } = require("mongodb")
const mongoClient = new MongoClient(process.env.MONGO_URI)

const { Configuration, OpenAIApi } = require("openai");
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openAiClient = new OpenAIApi(configuration);

// TODO, figure out how to throw some error if mongo isn't working
 

async function go() {
	const bots = [ /*
		new Bot('automilady', 'curie:ft-personal:milady-prompts-fixed-2022-08-19-21-58-44', 1000 * 60 * 60 * 3),	
		new Bot('angelicism_bk', 'curie:ft-personal:angelicism-2022-08-18-22-45-06', 1000 * 60 * 60 * 3),	
		new Bot('lindycannibal','curie:ft-personal:frogtwitter-2022-08-19-15-37-55', 1000 * 60 * 60 * 4),
		new HivemindBot('gatheringness','curie:ft-personal:hivemind-2022-08-19-21-28-10', 1000 * 60 * 60 * 2)
		*/
	]

	for (bot of bots) {
		bot.start()
	}

	const mongoDatabase = mongoClient.db('hivemind')
	const misc = mongoDatabase.collection('misc')
	const hivemindGpt3Model = (await misc.findOne({ key: 'HIVEMIND_CURRENT_MODEL' })).value

	const hivemindBot = new DiscordHivemindBot({openAiClient, mongoClient, gpt3Model: hivemindGpt3Model, name:'HIVEMIND', replyFrequency:10})

	const discordBots = [
		new DiscordBot({ name:'automilady', gpt3Model:'curie:ft-personal:milady-prompts-fixed-2022-08-19-21-58-44', replyFrequency:10 }),
		new DiscordBot({ name:'Cornelius Kennington', gpt3Model:'curie:ft-personal:frogtwitter-2022-08-19-15-37-55', replyFrequency:10}),
		new DiscordBot({ name:'Angelicism Bangkok', gpt3Model:'curie:ft-personal:angelicism-2022-08-18-22-45-06', replyFrequency:10}),
		hivemindBot
	]

	for ( discordBot of discordBots ) {
		discordBot.start()
	}


	const twitterClientAppAuth = new TwitterApi(process.env.TWITTER_BEARER_TOKEN)

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

}
go()