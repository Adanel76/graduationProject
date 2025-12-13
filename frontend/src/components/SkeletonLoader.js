import React from 'react';

const SkeletonLoader = ({ type = 'card', count = 1 }) => {
  const skeletons = Array.from({ length: count }, (_, i) => i);

  if (type === 'card') {
    return (
      <>
        {skeletons.map((i) => (
          <div key={i} style={{
            backgroundColor: 'white',
            borderRadius: '12px',
            overflow: 'hidden',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            height: '400px',
          }}>
            <div style={{
              height: '200px',
              backgroundColor: '#f0f0f0',
              animation: 'pulse 1.5s ease-in-out infinite'
            }}></div>
            <div style={{ padding: '1.5rem' }}>
              <div style={{
                height: '24px',
                backgroundColor: '#f0f0f0',
                borderRadius: '4px',
                marginBottom: '1rem',
                animation: 'pulse 1.5s ease-in-out infinite'
              }}></div>
              <div style={{
                height: '16px',
                backgroundColor: '#f0f0f0',
                borderRadius: '4px',
                marginBottom: '0.5rem',
                animation: 'pulse 1.5s ease-in-out infinite 0.2s'
              }}></div>
              <div style={{
                height: '16px',
                backgroundColor: '#f0f0f0',
                borderRadius: '4px',
                marginBottom: '1rem',
                animation: 'pulse 1.5s ease-in-out infinite 0.4s'
              }}></div>
              <div style={{
                height: '32px',
                backgroundColor: '#f0f0f0',
                borderRadius: '4px',
                animation: 'pulse 1.5s ease-in-out infinite 0.6s'
              }}></div>
            </div>
          </div>
        ))}
      </>
    );
  }

  return null;
};

export default SkeletonLoader;
