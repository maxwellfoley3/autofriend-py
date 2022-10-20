import React, {useState, useEffect} from 'react'
import { getFinetuneDoc } from '../api'
import './FinetuneDoc.scss'

type FinetuneLine = { prompt: string, completion: string }
export default function FinetuneDoc ({botName} : {botName: string}) {
  const [finetuneDoc, setFinetuneDoc] = useState<FinetuneLine[] | null>(null)
  useEffect(() => {
    getFinetuneDoc(botName).then(doc => setFinetuneDoc(doc.split('\n').map((line:string)=>JSON.parse(line))))
  }, [])  

  return (
		<div className='FinetuneDoc'>
      <h2>Finetune doc for {botName}</h2>
      <table>
        <tbody>
          <tr className='table-header'>
            <td className='left-col cell'>Prompt</td>
            <td className='right-col cell'>Completion</td>
          </tr>
          <>
          {
            finetuneDoc && finetuneDoc.map((line, i) => 
              <tr className='table-row' key={i}> 
                <td className='left-col cell'>{line.prompt}</td>
                <td className='right-col cell'>{line.completion}</td>
              </tr>
            )
          }
          </>
        </tbody>

      </table>
    </div>
  )
}
