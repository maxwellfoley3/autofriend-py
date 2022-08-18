const axios = require('axios');
const randomWords = require('random-words');
const config = require('./config.js');
const { TwitterApi } = require('twitter-api-v2');
const twitterClient = new TwitterApi(
	config.twitter
);

console.log("Running twitter bot")

tweetMilady()

setInterval(
	tweetMilady,
	1000 * 60 * 60 * 3
)

async function generateMiladyTweet(prompt) {
	return await axios({
		method: 'post',
		url: 'https://api.openai.com/v1/completions',
		headers: {
			'Content-Type': 'application/json',
			'Authorization': 'Bearer ' + config.openAiApiKey,
		}, 
		data: {
			model: 'curie:ft-personal:milady-small-unsplit-stopsequence-2022-08-04-21-47-28', 
			prompt, 
			temperature: .9, 
			max_tokens: 54,
			stop: ['###']
		}
	})
}

async function tweetHasCompleteSentences(tweet) {
	const res = await axios({
		method: 'post',
		url: 'https://api.openai.com/v1/completions',
		headers: {
			'Content-Type': 'application/json',
			'Authorization': 'Bearer ' + config.openAiApiKey,
		}, 
		data: {
			model: 'text-davinci-002', 
			prompt: `Please respond 'A' if this fragment of text begins at the beginning \
			of a sentence and ends at the end of a sentence, and 'B' if it starts in \
			the middle of a sentence or cuts off before it reaches the end of a sentence: \
			${tweet}`, 
			temperature: 0, 
			max_tokens: 54,
		}
	})
	answer = res.data.choices[0].text
	console.log('has complete sentences',answer)
	if (answer.trim() == 'A') {
		return true;
	}
}

async function tweetHasMeaningfulWords(tweet) {
	const res = await axios({
		method: 'post',
		url: 'https://api.openai.com/v1/completions',
		headers: {
			'Content-Type': 'application/json',
			'Authorization': 'Bearer ' + config.openAiApiKey,
		}, 
		data: {
			model: 'text-davinci-002', 
			prompt: `Please respond 'A' if this fragment of text contains only meaningful \
			words, and 'B' if it contains nonsense words: \
			${tweet}`, 
			temperature: 0, 
			max_tokens: 54,
		}
	})
	answer = res.data.choices[0].text
	console.log('has nonsense words',answer)
	if (answer.trim() == 'A') {
		return true;
	}
}

async function tweetMilady() {
	try { 
		console.log("Sending gpt-3 request")
		let validTweetFound = false;
		let tweetText = '';
		const prompt = randomWords();
		while(!validTweetFound) {
			const res = await generateMiladyTweet(prompt);
			tweetText = res.data.choices[0].text;
			console.log("Got gpt-3 response", tweetText)
			validTweetFound = (await tweetHasCompleteSentences(tweetText)) 
			&& (await tweetHasMeaningfulWords(tweetText));
		}

		console.log("Tweeting: " + tweetText);
		return twitterClient.v2.tweet(tweetText);
	} catch (err) {
		console.log(err);
	}
}
