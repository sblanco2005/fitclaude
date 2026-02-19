import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  glass?: boolean;
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  hover = false,
  glass = true,
}) => {
  const baseStyles = 'rounded-xl p-6 transition-all duration-200';
  const glassStyles = glass ? 'glass' : 'bg-card';
  const hoverStyles = hover ? 'glass-hover cursor-pointer' : '';

  return (
    <div className={`${baseStyles} ${glassStyles} ${hoverStyles} ${className}`}>
      {children}
    </div>
  );
};
