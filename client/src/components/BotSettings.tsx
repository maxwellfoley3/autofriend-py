import React, { useState, useEffect, useContext } from 'react'
import { ConfigContext, UserContext } from '../contexts'
import { BotPromptStyle } from '../types'
import { postConfig } from '../api'
import './BotSettings.scss'

export default function BotSettings({botName}: {botName: string}) {
	const config = useContext(ConfigContext)
	const { user } = useContext(UserContext)
	if (!config || !user) { return null }
	const bot = config.twitter[botName]

  const [isActive, setIsActive] = useState<boolean>(bot.active)
	const [tweetFrequency, setTweetFrequency] = useState<number>(bot.tweetFrequency)
	const [promptStyle, setPromptStyle] = useState<BotPromptStyle>(bot.promptStyle)
	
	const submit = () => {
		const newConfig = { 
			...config, 
			twitter: {
				...config.twitter,
				[botName]:{
					...config.twitter[botName],
					active: isActive,
					tweetFrequency,
					promptStyle,
				}
			}
		}
		postConfig(newConfig, user.token)
	}

	return (
		<div className='BotSettings'>
			<h2>Bot config</h2>
			<h4>Test</h4>
			<button className={'big'}>Tweet now</button>
			<h4>Settings</h4>
			<li>
				<label>Is active?</label>
				<div>
					<input type='checkbox' checked={isActive} onChange={(evt)=>setIsActive(evt.target.checked)}/>
					{ isActive ? 'Yes' : 'No' }
				</div>
			</li>
			<li> 
				<label>Tweet frequency</label>
				<div>
					Every <input className='number-input' type='number' value={tweetFrequency / (60*1000)} onChange={(evt)=>setTweetFrequency(parseInt(evt.target.value) * (60*1000))}/> minutes
				</div>
			</li>
			<li>
				<label>Prompt style</label>
				<select value={promptStyle} onChange={(evt)=>setPromptStyle(evt.target.value as BotPromptStyle)}>
					<option value='dictionary'>Dictionary</option>
					<option value='blank'>Blank</option>
				</select>
				<div>
					{promptStyle === 'dictionary' && 'The bot will be prompted by a random English word from the dictionary.'}
					{promptStyle === 'blank' && 'The bot will be prompted by the empty string.'}
				</div>
			</li>
			<button onClick={submit}>Save</button>
		</div>
	)
}