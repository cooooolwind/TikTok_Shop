import { useEffect } from 'react';
import { useSocket } from './useSocket';
import { useMaterialStore } from '../stores/useMaterialStore';

/**
 * 监听素材分析完成的全局订阅
 */
export function useMaterialSubscription() {
  const { onMaterialAnalyzed } = useSocket();
  const setMaterialAnalyzed = useMaterialStore((s) => s.setMaterialAnalyzed);

  useEffect(() => {
    const unsub = onMaterialAnalyzed((data) => {
      if (data.material_id) {
        setMaterialAnalyzed(data.material_id, data.ai_tags, data.ai_description);
      }
    });

    return () => unsub();
  }, [onMaterialAnalyzed, setMaterialAnalyzed]);
}
