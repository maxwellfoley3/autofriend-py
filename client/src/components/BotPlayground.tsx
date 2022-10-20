import React from 'react'
import GptTest from './GptTest'
import BotSettings from './BotSettings'
import FinetuneDoc from './FinetuneDoc'
import './BotPlayground.scss'

export default function BotPlayground ({botName, bot}: {botName: string, bot: any}) {
  return (
    <div className='BotPlayground'>
      <div style={{ width: '30em' }}>{/*'100vw - 20em'}}>*/}
        <GptTest botName={botName} model={bot.gpt3Model}/> 
      </div>
      <div style={{ width: '25em' }}>
        <BotSettings botName={botName}/>
      </div>
      <div style={{ width: '100%'}}>
        <FinetuneDoc botName={botName}/>
      </div>
    </div>
  )
}