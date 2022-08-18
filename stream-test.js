const config = require('./config.js');
const { ETwitterStreamEvent, TwitterApi } = require('twitter-api-v2');
const client = new TwitterApi(
	config.twitter.bearer_token
);

async function startStream(userName){
	try {
		const rules = await client.v2.streamRules();

		console.log('rules',rules)
		if (rules.data && rules.data.length) {
			await client.v2.updateStreamRules({
				delete: { ids: rules.data.map(rule => rule.id) },
			});
		}

		await client.v2.updateStreamRules({
			add: [
				{ value: `milady`, tag: `milady` },
			],
		})

		const stream = await client.v2.searchStream({
			'tweet.fields': ['referenced_tweets', 'author_id'],
			expansions: ['referenced_tweets.id'],
		})

		stream.autoReconnect = true;

		stream.on(ETwitterStreamEvent.Data, async tweet => {
			console.log(tweet.data)
		})
	} catch (e) {
		console.log(e);
	}
}

startStream()