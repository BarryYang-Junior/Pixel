import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger';
  isLoading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  isLoading, 
  className = '', 
  disabled,
  ...props 
}) => {
  const baseStyles = "font-mono text-lg px-6 py-2 border-b-4 active:border-b-0 active:translate-y-1 transition-all uppercase tracking-wider";
  
  const variants = {
    primary: "bg-retro-accent text-retro-dark border-blue-800 hover:bg-blue-300",
    secondary: "bg-retro-panel text-slate-300 border-retro-border hover:bg-slate-700",
    danger: "bg-retro-error text-white border-red-900 hover:bg-red-400"
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${isLoading || disabled ? 'opacity-50 cursor-not-allowed' : ''} ${className}`}
      disabled={isLoading || disabled}
      {...props}
    >
      {isLoading ? 'Processing...' : children}
    </button>
  );
};