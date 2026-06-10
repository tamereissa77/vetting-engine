import React from 'react';

interface AssessmentRingProps {
  score: number;
  hasRedFlags: boolean;
  size?: number;
}

export const AssessmentRing: React.FC<AssessmentRingProps> = ({ score, hasRedFlags, size = 120 }) => {
  const radius = size * 0.4;
  const strokeWidth = size * 0.08;
  const normalizedRadius = radius - strokeWidth * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  // Compute colors based on criteria
  let color = 'stroke-cyber-cyan';
  let glowFilter = 'drop-shadow(0 0 8px rgba(0, 242, 254, 0.6))';
  let textClass = 'text-cyber-cyan';

  if (hasRedFlags || score < 50) {
    color = 'stroke-cyber-magenta';
    glowFilter = 'drop-shadow(0 0 8px rgba(217, 70, 239, 0.6))';
    textClass = 'text-cyber-magenta';
  } else if (score >= 50 && score < 80) {
    color = 'stroke-cyber-yellow';
    glowFilter = 'drop-shadow(0 0 8px rgba(245, 158, 11, 0.6))';
    textClass = 'text-cyber-yellow';
  }

  return (
    <div className="flex flex-col items-center justify-center relative" style={{ width: size, height: size }}>
      <svg height={size} width={size} className="transform -rotate-90">
        {/* Track Ring */}
        <circle
          className="stroke-cyber-slate/30"
          fill="transparent"
          strokeWidth={strokeWidth}
          r={normalizedRadius}
          cx={size / 2}
          cy={size / 2}
        />
        {/* Progress Ring */}
        <circle
          className={`${color} transition-all duration-1000 ease-out`}
          fill="transparent"
          strokeWidth={strokeWidth}
          strokeDasharray={circumference + ' ' + circumference}
          style={{ strokeDashoffset, filter: glowFilter }}
          strokeLinecap="round"
          r={normalizedRadius}
          cx={size / 2}
          cy={size / 2}
        />
      </svg>
      {/* Centered Score */}
      <div className="absolute flex flex-col items-center justify-center">
        <span className={`text-2xl font-bold font-mono ${textClass}`}>
          {score}%
        </span>
        <span className="text-[10px] uppercase tracking-wider text-slate-400 font-mono">
          FIT SCORE
        </span>
      </div>
    </div>
  );
};
