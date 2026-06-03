import { useEffect } from 'react';
import { useSocket } from './useSocket';
import { useMaterialStore } from '../stores/useMaterialStore';

/**
 * 监听素材分析完成和失败的全局订阅
 */
export function useMaterialSubscription() {
  const { onMaterialAnalyzed, onMaterialAnalysisFailed } = useSocket();
  const setMaterialAnalyzed = useMaterialStore((s) => s.setMaterialAnalyzed);
  const setMaterialAnalysisFailed = useMaterialStore((s) => s.setMaterialAnalysisFailed);

  useEffect(() => {
    const unsub1 = onMaterialAnalyzed((data) => {
      if (data.material_id) {
        setMaterialAnalyzed(data.material_id, data.ai_tags, data.ai_description);
      }
    });

    const unsub2 = onMaterialAnalysisFailed((data) => {
      if (data.material_id) {
        setMaterialAnalysisFailed(data.material_id, data.error);
      }
    });

    return () => {
      unsub1();
      unsub2();
    };
  }, [onMaterialAnalyzed, onMaterialAnalysisFailed, setMaterialAnalyzed, setMaterialAnalysisFailed]);
}
