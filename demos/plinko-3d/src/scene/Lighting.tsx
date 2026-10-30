import { Environment, Lightformer } from '@react-three/drei';

// Окружение собирается из светящихся панелей прямо в сцене: без файлов HDR и без сети.
export function Lighting() {
  return (
    <>
      <ambientLight intensity={0.25} />
      <directionalLight position={[4, 10, 12]} intensity={1.2} color="#ffffff" />
      <Environment resolution={256} frames={1} background={false}>
        <Lightformer form="rect" intensity={3} color="#ffffff" position={[0, 9, 6]} rotation-x={Math.PI / 2} scale={[14, 3, 1]} />
        <Lightformer form="rect" intensity={2.2} color="#b9a7ff" position={[-11, 0, 4]} rotation-y={Math.PI / 2} scale={[4, 14, 1]} />
        <Lightformer form="rect" intensity={1.6} color="#ff7ae6" position={[11, -2, 4]} rotation-y={-Math.PI / 2} scale={[4, 12, 1]} />
        <Lightformer form="rect" intensity={1.2} color="#6a4fd6" position={[0, -10, 3]} rotation-x={-Math.PI / 2} scale={[16, 4, 1]} />
        <Lightformer form="rect" intensity={0.6} color="#ffffff" position={[0, 0, 12]} scale={[12, 12, 1]} />
        <Lightformer form="ring" intensity={2} color="#ffffff" position={[6, 6, 8]} scale={2.5} />
      </Environment>
    </>
  );
}
