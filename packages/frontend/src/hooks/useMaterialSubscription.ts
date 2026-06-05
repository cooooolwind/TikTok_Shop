import { useEffect } from 'react';
import { useSocket } from './useSocket';
import { useMaterialStore } from '../stores/useMaterialStore';

/**
 * 监听素材分析完成和失败的全局订阅
 */
export function useMaterialSubscription() {
  const { onMaterialAnalyzed, onMaterialAnalysisFailed, onMaterialAnalysisStep } = useSocket();
  const setMaterialAnalyzed = useMaterialStore((s) => s.setMaterialAnalyzed);
  const setMaterialAnalysisFailed = useMaterialStore((s) => s.setMaterialAnalysisFailed);
  const setMaterialAnalysisStep = useMaterialStore((s) => s.setMaterialAnalysisStep);

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

    const unsub3 = onMaterialAnalysisStep((data) => {
      if (data.material_id) {
        setMaterialAnalysisStep(data.material_id, data.step);
      }
    });

    return () => {
      unsub1();
      unsub2();
      unsub3();
    };
  }, [onMaterialAnalyzed, onMaterialAnalysisFailed, onMaterialAnalysisStep, setMaterialAnalyzed, setMaterialAnalysisFailed, setMaterialAnalysisStep]);
}
