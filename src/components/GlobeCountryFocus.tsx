import { useEffect } from "react";
import { useThree } from "@react-three/fiber";

interface Props {
  country?: string | null;
}

// Подготовительный компонент для следующего этапа:
// выбор страны будет управлять камерой глобуса.
export default function GlobeCountryFocus({ country }: Props) {
  const { camera } = useThree();

  useEffect(() => {
    if (!country) return;
    // Камера оставлена стабильной до подключения точных координат стран.
    camera.updateProjectionMatrix();
  }, [country, camera]);

  return null;
}
