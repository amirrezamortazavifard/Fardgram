import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Sparkles } from "lucide-react";
import { getMessageEffect } from "../telegram/messageEffects";
import { usePreferencesStore } from "../store/preferencesStore";

interface ParticleItem {
  id: number;
  emoji: string;
  x: number;
  y: number;
  size: number;
  duration: number;
  delay: number;
}

export interface MessageEffectPlayerProps {
  effectId?: string;
  className?: string;
  autoPlay?: boolean;
}

export const MessageEffectPlayer: React.FC<MessageEffectPlayerProps> = ({
  effectId,
  className = "",
  autoPlay = true,
}) => {
  const effect = useMemo(() => getMessageEffect(effectId), [effectId]);
  const reduceMotion = usePreferencesStore((state) => state.effectiveReduceMotion);
  const autoplayAnimations = usePreferencesStore((state) => state.autoplayAnimations);

  const [isPlaying, setIsPlaying] = useState(false);
  const [particles, setParticles] = useState<ParticleItem[]>([]);

  const triggerAnimation = useCallback(() => {
    if (!effect || reduceMotion) return;

    // Generate randomized particles
    const generated: ParticleItem[] = Array.from({ length: 12 }, (_, i) => ({
      id: Date.now() + i,
      emoji: effect.particles[i % effect.particles.length],
      x: (Math.random() - 0.5) * 140, // -70px to +70px horizontal spread
      y: -(Math.random() * 80 + 30), // -30px to -110px vertical rise
      size: Math.random() * 8 + 14, // 14px to 22px
      duration: Math.random() * 0.4 + 1.2, // 1.2s to 1.6s
      delay: Math.random() * 0.2, // 0 to 0.2s
    }));

    setParticles(generated);
    setIsPlaying(true);

    const timeout = setTimeout(() => {
      setIsPlaying(false);
      setParticles([]);
    }, 1800);

    return () => clearTimeout(timeout);
  }, [effect, reduceMotion]);

  useEffect(() => {
    if (autoPlay && autoplayAnimations && !reduceMotion) {
      const cancel = triggerAnimation();
      return () => cancel?.();
    }
  }, [autoPlay, autoplayAnimations, reduceMotion, triggerAnimation]);

  if (!effect) return null;

  return (
    <div
      className={`relative inline-flex items-center message-effect-container ${className}`.trim()}
      data-testid="message-effect-player"
      data-effect-id={effect.id}
    >
      {/* Floating Particles Overlay */}
      {isPlaying && !reduceMotion && (
        <div
          className="absolute inset-0 pointer-events-none z-30 overflow-visible"
          aria-hidden="true"
        >
          {particles.map((particle) => (
            <span
              key={particle.id}
              className="absolute select-none pointer-events-none animate-message-particle"
              style={{
                fontSize: `${particle.size}px`,
                left: "50%",
                bottom: "50%",
                transform: `translate(${particle.x}px, ${particle.y}px)`,
                animationDuration: `${particle.duration}s`,
                animationDelay: `${particle.delay}s`,
              }}
            >
              {particle.emoji}
            </span>
          ))}
        </div>
      )}

      {/* Message Effect Badge / Interactive Replay Button */}
      <button
        type="button"
        onClick={triggerAnimation}
        title={`${effect.name} effect (${effect.description}) - Click to replay`}
        aria-label={`${effect.name} message effect`}
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700/60 shadow-xs transition-transform active:scale-95 cursor-pointer backdrop-blur-xs"
      >
        <span className="text-sm leading-none">{effect.emoji}</span>
        <Sparkles size={11} className="text-amber-500 opacity-80" />
      </button>
    </div>
  );
};
