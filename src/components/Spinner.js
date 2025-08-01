import React from 'react';
import './Spinner.css';

const Spinner = ({ size = 'small', color = '#ffffff' }) => {
  return (
    <div className={`spinner spinner-${size}`} style={{ borderTopColor: color }}>
    </div>
  );
};

export default Spinner;