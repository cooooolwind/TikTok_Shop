import { useEffect } from 'react';
import { useSocket } from './useSocket';
import { useMaterialStore } from '../stores/useMaterialStore';

/**
 * 监听素材分析完成和失败的全局订阅
 */
export function useMaterialSubscription() {
  const { onMaterialAnalyzed, onMaterialAnalysisFailed, onMaterialAnalysisStep, onMaterialEmbeddingComplete, onMaterialEmbeddingFailed } = useSocket();
  const setMaterialAnalyzed = useMaterialStore((s) => s.setMaterialAnalyzed);
  const setMaterialAnalysisFailed = useMaterialStore((s) => s.setMaterialAnalysisFailed);
  const setMaterialAnalysisStep = useMaterialStore((s) => s.setMaterialAnalysisStep);
  const setMaterialEmbeddingComplete = useMaterialStore((s) => s.setMaterialEmbeddingComplete);
  const setMaterialEmbeddingFailed = useMaterialStore((s) => s.setMaterialEmbeddingFailed);

  useEffect(() => {
    const unsub1 = onMaterialAnalyzed((data) => {
      if (data.material_id) {
        setMaterialAnalyzed(data.material_id, data.ai_tags, data.ai_description, data.name);
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

    const unsub4 = onMaterialEmbeddingComplete((data) => {
      if (data.material_id) {
        setMaterialEmbeddingComplete(data.material_id);
      }
    });

    const unsub5 = onMaterialEmbeddingFailed((data) => {
      if (data.material_id) {
        setMaterialEmbeddingFailed(data.material_id, data.error);
      }
    });

    return () => {
      unsub1();
      unsub2();
      unsub3();
      unsub4();
      unsub5();
    };
  }, [onMaterialAnalyzed, onMaterialAnalysisFailed, onMaterialAnalysisStep, onMaterialEmbeddingComplete, onMaterialEmbeddingFailed, setMaterialAnalyzed, setMaterialAnalysisFailed, setMaterialAnalysisStep, setMaterialEmbeddingComplete, setMaterialEmbeddingFailed]);
}
