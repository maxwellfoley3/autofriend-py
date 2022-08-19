const axios = require('axios');

module.exports.sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

module.exports.repeatedlyQuery = async function(params, maxAttempts = 10) {
	let attempts = 0
	while(true) {
		try {
			return await axios(params)
		} catch (err) {
			console.log('Error in repeatedlyQuery', err)
			if (err.message == 'Request failed with status code 500') {
				await sleep(5000)
			}
			attempts++
			if (attempts >= maxAttempts) {
				throw err
			}
		}
	}
}