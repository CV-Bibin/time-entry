import React from 'react';

export default function CustomAlert({ config, closeAlert }) {
  if (!config.isOpen) return null;

  const isConfirm = config.type === 'confirm' || config.type === 'danger-confirm';
  const confirmColor = config.type === 'danger-confirm' ? '#d32f2f' : '#007BFF';

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999, animation: 'fadeIn 0.2s ease-in-out' }}>
      <div style={{ backgroundColor: '#fff', padding: '25px', borderRadius: '12px', width: '90%', maxWidth: '400px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', textAlign: 'center' }}>
        <h3 style={{ marginTop: 0, color: config.type === 'error' ? '#d32f2f' : '#333' }}>{config.title}</h3>
        <p style={{ color: '#555', fontSize: '15px', lineHeight: '1.5', marginBottom: '25px' }}>{config.message}</p>
        
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
          {isConfirm && (
            <button onClick={closeAlert} style={{ flex: 1, padding: '10px', background: '#f1f3f5', color: '#333', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
              Cancel
            </button>
          )}
          <button 
            onClick={() => { if (config.onConfirm) config.onConfirm(); closeAlert(); }} 
            style={{ flex: 1, padding: '10px', background: isConfirm ? confirmColor : '#007BFF', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}
          >
            {isConfirm ? config.confirmText || 'Confirm' : 'Okay'}
          </button>
        </div>
      </div>
    </div>
  );
}