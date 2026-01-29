/**
 * HELIOS Voice Avatar - 3D audio-reactive visualization
 * Based on HealthAvatar3D with HELIOS branding (#1D4E5F)
 */

import { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, MeshDistortMaterial, Sphere, Environment, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';

interface AvatarCoreProps {
  fft: number[];
  isSpeaking: boolean;
  isListening: boolean;
}

function AvatarCore({ fft, isSpeaking, isListening }: AvatarCoreProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const innerRef = useRef<THREE.Mesh>(null);
  const ringsRef = useRef<THREE.Group>(null);
  
  // Calculate audio volume from FFT
  const volume = useMemo(() => {
    if (!fft || fft.length === 0) return 0;
    return fft.reduce((a, b) => a + b, 0) / fft.length;
  }, [fft]);

  // Animate based on state
  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    
    if (meshRef.current) {
      // Breathing animation when idle
      const breathe = Math.sin(time * 0.5) * 0.05;
      meshRef.current.scale.setScalar(1 + breathe + (isSpeaking ? volume * 0.3 : 0));
      
      // Gentle rotation
      meshRef.current.rotation.y = Math.sin(time * 0.3) * 0.1;
      meshRef.current.rotation.x = Math.cos(time * 0.2) * 0.05;
    }

    if (innerRef.current) {
      // Inner orb pulses more when speaking
      const pulse = isSpeaking ? 0.8 + volume * 0.4 : 0.85 + Math.sin(time * 2) * 0.05;
      innerRef.current.scale.setScalar(pulse);
    }

    if (ringsRef.current) {
      // Rotate rings
      ringsRef.current.rotation.z = time * 0.2;
      ringsRef.current.rotation.x = Math.sin(time * 0.5) * 0.3;
      
      // Scale rings based on speaking
      const ringScale = isSpeaking ? 1 + volume * 0.2 : 1;
      ringsRef.current.scale.setScalar(ringScale);
    }
  });

  // Dynamic color based on state - HELIOS branding
  const primaryColor = useMemo(() => {
    if (isSpeaking) return '#1D4E5F'; // sovereignTeal when speaking
    if (isListening) return '#2A8C86'; // teal when listening
    return '#64748B'; // Slate when idle
  }, [isSpeaking, isListening]);

  const secondaryColor = useMemo(() => {
    if (isSpeaking) return '#10B981'; // Emerald
    if (isListening) return '#1D4E5F'; // sovereignTeal
    return '#94A3B8'; // Slate
  }, [isSpeaking, isListening]);

  return (
    <group>
      {/* Main orb with distortion */}
      <mesh ref={meshRef}>
        <Sphere args={[1, 64, 64]}>
          <MeshDistortMaterial
            color={primaryColor}
            attach="material"
            distort={isSpeaking ? 0.3 + volume * 0.3 : 0.2}
            speed={isSpeaking ? 4 : 2}
            roughness={0.2}
            metalness={0.8}
            envMapIntensity={1}
          />
        </Sphere>
      </mesh>

      {/* Inner glowing core */}
      <mesh ref={innerRef}>
        <Sphere args={[0.6, 32, 32]}>
          <meshStandardMaterial
            color={secondaryColor}
            emissive={secondaryColor}
            emissiveIntensity={isSpeaking ? 0.5 + volume : 0.3}
            transparent
            opacity={0.9}
          />
        </Sphere>
      </mesh>

      {/* Orbital rings */}
      <group ref={ringsRef}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[1.5, 0.02, 16, 100]} />
          <meshStandardMaterial
            color={primaryColor}
            emissive={primaryColor}
            emissiveIntensity={0.5}
            transparent
            opacity={0.6}
          />
        </mesh>
        <mesh rotation={[Math.PI / 3, Math.PI / 4, 0]}>
          <torusGeometry args={[1.7, 0.015, 16, 100]} />
          <meshStandardMaterial
            color={secondaryColor}
            emissive={secondaryColor}
            emissiveIntensity={0.3}
            transparent
            opacity={0.4}
          />
        </mesh>
      </group>

      {/* Particle aura when speaking */}
      {isSpeaking && (
        <Float speed={3} floatIntensity={0.5}>
          {[...Array(8)].map((_, i) => (
            <mesh
              key={i}
              position={[
                Math.cos((i / 8) * Math.PI * 2) * 2,
                Math.sin((i / 8) * Math.PI * 2) * 2,
                0
              ]}
            >
              <sphereGeometry args={[0.05 + volume * 0.05, 16, 16]} />
              <meshStandardMaterial
                color="#1D4E5F"
                emissive="#1D4E5F"
                emissiveIntensity={1}
              />
            </mesh>
          ))}
        </Float>
      )}
    </group>
  );
}

interface HeliosVoiceAvatarProps {
  fft: number[];
  isSpeaking: boolean;
  isListening: boolean;
  className?: string;
}

export function HeliosVoiceAvatar({ fft, isSpeaking, isListening, className }: HeliosVoiceAvatarProps) {
  return (
    <div className={className}>
      <Canvas
        camera={{ position: [0, 0, 5], fov: 45 }}
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={0.4} />
        <pointLight position={[10, 10, 10]} intensity={1} />
        <pointLight position={[-10, -10, -10]} intensity={0.5} color="#1D4E5F" />
        <spotLight
          position={[0, 5, 5]}
          angle={0.3}
          penumbra={1}
          intensity={1}
          castShadow
        />
        
        <Float speed={1.5} rotationIntensity={0.2} floatIntensity={0.5}>
          <AvatarCore fft={fft} isSpeaking={isSpeaking} isListening={isListening} />
        </Float>
        
        <ContactShadows
          position={[0, -2.5, 0]}
          opacity={0.4}
          scale={10}
          blur={2}
          far={4}
        />
        
        <Environment preset="city" />
      </Canvas>
    </div>
  );
}
