import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Sphere } from '@react-three/drei';
import { useRef } from 'react';
import * as THREE from 'three';

function Volleyball() {
  const meshRef = useRef<THREE.Mesh>(null);

  // Бөмбөгийг тогтмол аажуухан эргүүлэх үйлдэл
  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.008;
      meshRef.current.rotation.x += 0.008;
    }
  });

  return (
    <mesh ref={meshRef}>
      {/* Волейболын бөмбөг шиг хээ үүсгэхийн тулд wireframe ашиглаж болно, эсвэл шар+цэнхэр өнгө */}
      <sphereGeometry args={[2.2, 32, 32]} />
      <meshStandardMaterial 
        color="#ff7a00" // Stars Volleyball-ийн улбар шар өнгө
        roughness={0.3}
        metalness={0.1}
        wireframe={false} // Хэрэв шугаман тор хэлбэртэй болгох бол true болгоно
      />
    </mesh>
  );
}

export default function VolleyballScene() {
  return (
    <div style={{ width: '100%', height: '100%', minHeight: '400px' }}>
      <Canvas camera={{ position: [0, 0, 5], fov: 45 }}>
        {/* Гэрэлтүүлэг */}
        <ambientLight intensity={0.7} />
        <directionalLight position={[5, 5, 5]} intensity={1.5} castShadow />
        <pointLight position={[-5, -5, -5]} intensity={0.5} />
        
        {/* 3D Бөмбөг */}
        <Volleyball />

        {/* Хэрэглэгч хулганаараа эргүүлж үзэх боломжтой болгох */}
        <OrbitControls enableZoom={false} autoRotate={false} />
      </Canvas>
    </div>
  );
}