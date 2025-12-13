import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';

const SupportChat = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    // В реальном приложении здесь будет подключение к WebSocket
    // const newSocket = io('http://localhost:8000');
    // setSocket(newSocket);
    
    // Имитация получения сообщений
    setMessages([
      {
        id: 1,
        sender: 'support',
        text: 'Здравствуйте! Чем могу помочь?',
        timestamp: new Date(Date.now() - 300000)
      }
    ]);

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, []);

  const sendMessage = () => {
    if (newMessage.trim()) {
      const message = {
        id: messages.length + 1,
        sender: 'user',
        text: newMessage,
        timestamp: new Date()
      };
      
      setMessages([...messages, message]);
      setNewMessage('');
      
      // Имитация ответа поддержки
      setTimeout(() => {
        setMessages(prev => [...prev, {
          id: prev.length + 1,
          sender: 'support',
          text: 'Спасибо за ваше сообщение! Мы свяжемся с вами в ближайшее время.',
          timestamp: new Date()
        }]);
      }, 2000);
    }
  };

  return (
    <>
      {isOpen && (
        <div style={{
          position: 'fixed',
          bottom: '80px',
          right: '20px',
          width: '350px',
          height: '400px',
          backgroundColor: 'white',
          borderRadius: '10px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
          zIndex: 1000,
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{
            backgroundColor: '#3498db',
            color: 'white',
            padding: '1rem',
            borderRadius: '10px 10px 0 0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <h3 style={{ margin: 0, fontSize: '1rem' }}>💬 Поддержка</h3>
            <button 
              onClick={() => setIsOpen(false)}
              style={{
                background: 'none',
                border: 'none',
                color: 'white',
                cursor: 'pointer',
                fontSize: '1.2rem'
              }}
            >
              ×
            </button>
          </div>
          
          <div style={{
            flex: 1,
            padding: '1rem',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem'
          }}>
            {messages.map(message => (
              <div key={message.id} style={{
                maxWidth: '80%',
                padding: '0.75rem',
                borderRadius: '15px',
                alignSelf: message.sender === 'user' ? 'flex-end' : 'flex-start',
                backgroundColor: message.sender === 'user' ? '#3498db' : '#f0f0f0',
                color: message.sender === 'user' ? 'white' : '#333',
                fontSize: '0.9rem'
              }}>
                {message.text}
                <div style={{
                  fontSize: '0.7rem',
                  opacity: 0.7,
                  marginTop: '0.25rem',
                  textAlign: message.sender === 'user' ? 'right' : 'left'
                }}>
                  {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            ))}
          </div>
          
          <div style={{
            padding: '1rem',
            borderTop: '1px solid #eee',
            display: 'flex',
            gap: '0.5rem'
          }}>
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="Введите сообщение..."
              style={{
                flex: 1,
                padding: '0.5rem',
                border: '1px solid #ddd',
                borderRadius: '20px',
                fontSize: '0.9rem'
              }}
            />
            <button 
              onClick={sendMessage}
              style={{
                backgroundColor: '#3498db',
                color: 'white',
                border: 'none',
                borderRadius: '20px',
                padding: '0.5rem 1rem',
                cursor: 'pointer'
              }}
            >
              ↵
            </button>
          </div>
        </div>
      )}
      
      <button 
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          width: '50px',
          height: '50px',
          backgroundColor: '#3498db',
          color: 'white',
          border: 'none',
          borderRadius: '50%',
          cursor: 'pointer',
          fontSize: '1.5rem',
          boxShadow: '0 5px 15px rgba(0,0,0,0.3)',
          zIndex: 1001
        }}
      >
        💬
      </button>
    </>
  );
};

export default SupportChat;
