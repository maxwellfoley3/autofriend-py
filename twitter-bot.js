const axios = require('axios');
const randomWords = require('random-words');
const config = require('./config.js');
const { TwitterApi } = require('twitter-api-v2');
const twitterClient = new TwitterApi(
	config.twitter
);

console.log("Running twitter bot")
setInterval(
	tweetMilady,
	1000 * 60 * 60 * 3
)

function tweetMilady() {
	axios({
		method: 'post',
		url: 'https://api.openai.com/v1/completions',
		headers: {
			'Content-Type': 'application/json',
			'Authorization': 'Bearer ' + config.openAiApiKey,
		}, 
		data: {
			model: 'curie:ft-personal:milady-small-unsplit-stopsequence-2022-08-04-21-47-28', 
			prompt: randomWords(), 
			temperature: .9, 
			max_tokens: 54,
			stop: ['###']
		}
	}
).then((res)=>{
	const tweetText = res.data.choices[0].text;
	console.log("Tweeting: " + tweetText);

	return twitterClient.v2.tweet(tweetText);
}).catch((err)=>{
	console.log(err);
})
}
