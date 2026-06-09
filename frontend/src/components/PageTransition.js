import React from 'react';

const PageTransition = ({ children, className = '' }) => {
  return <div className={`page-transition ${className}`.trim()}>{children}</div>;
};

export default PageTransition;