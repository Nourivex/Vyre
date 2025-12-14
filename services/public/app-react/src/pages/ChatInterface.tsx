import React, { useState } from 'react';

type Props = {
  isDark: boolean;
};

export default function ChatInterface({ isDark }: Props) {
  const [text, setText] = useState('');

  function handleSend() {
    if (!text) return;
    // placeholder: emit event or call api
    console.log('send message:', text);
    setText('');
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex-1 p-6 flex flex-col relative">
        <div className="absolute left-6 right-6 -top-2 flex items-center justify-between z-10">
          <h2 className={`text-2xl font-semibold ${isDark ? 'text-white' : 'text-gray-900'}`}>Chat Area</h2>
          <span className={isDark ? 'text-gray-300' : 'text-gray-500'}>Agent: Vyre Dev Assistant</span>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 py-4 pt-12">
          <p className={`chat-placeholder italic ${isDark ? 'text-gray-300' : 'text-gray-500'}`}>
            Placeholder for chat messages and history.
          </p>
        </div>

        <div className="mt-4 flex space-x-3">
          <input
            type="text"
            placeholder="Type your message here..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            className={`${isDark ? 'bg-gray-700 border-gray-600 text-white' : 'bg-gray-50 border-gray-200 text-gray-900'} flex-1 p-3 border rounded-lg focus:outline-none`}
          />
          <button onClick={handleSend} className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg transition duration-150">
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
