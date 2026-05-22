import { useState, useEffect, useRef } from 'react';

/**
 * 防抖搜索 Hook — value 在 delay 毫秒无变化后，才更新 debouncedValue
 * 用于搜索框即时输入但不即时触发 API
 */
export function useDebouncedSearch(delay = 400) {
  const [value, setValue] = useState('');
  const [debouncedValue, setDebouncedValue] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    timerRef.current = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => clearTimeout(timerRef.current);
  }, [value, delay]);

  return {
    value,
    debouncedValue,
    setValue,
    reset: () => {
      setValue('');
      setDebouncedValue('');
    },
  };
}
