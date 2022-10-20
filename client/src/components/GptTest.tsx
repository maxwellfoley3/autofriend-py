import React, { useState, useEffect } from 'react'
import { Editor, EditorState, Modifier } from 'draft-js'
import { promptGpt } from '../api'
import 'draft-js/dist/Draft.css'
import './GptTest.scss'

const styleMap = {
  'GREEN-HIGHLIGHT': {
    backgroundColor: '#cfc',
  },
}

export default function GptTest({ botName, model }: { botName:string, model: string}) {
  const [editorState, setEditorStateInner] = useState(
    () => EditorState.createEmpty()
  )

  useEffect(() => {
    setEditorStateInner(EditorState.createEmpty())
  }, [model])

  const setEditorState = (editorState: EditorState) => {
    setEditorStateInner(editorState)
  }

  const submit = () => {
    const text = editorState.getCurrentContent().getPlainText()
    promptGpt({ model, text })
      .then(res => {
        const newContentState = Modifier.replaceText(
          editorState.getCurrentContent(),
          editorState.getSelection(),
          res
        )
        // Todo, add green highlight back in 
        /*
        const newContentStateWithHighlight = Modifier.applyInlineStyle(
          newContentState,
          editorState.getSelection().merge({
            anchorOffset: text.length,
            focusOffset: text.length + res.length,
          }),
          'GREEN-HIGHLIGHT'
        )*/
        setEditorStateInner(EditorState.createWithContent(newContentState))
      })
  }

  return <div className="GptTest">
		<h2>Try {botName} out</h2>
    <Editor 
      editorState={editorState} 
      onChange={setEditorState} 
      customStyleMap={styleMap}
      placeholder={"Type something here"}
    />
    <button onClick={submit}>Submit</button>
  </div>
}
