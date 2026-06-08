import { useState, useCallback } from 'react';

/**
 * Hook для управления раскрывающимися элементами (аккордеон)
 * Поддерживает как объекты, так и Set для expanded items
 */
export const useAccordion = (initialExpanded = {}, useSet = false) => {
  const [expanded, setExpanded] = useState(() => {
    if (useSet) {
      // Если передан Set - используем его
      if (initialExpanded instanceof Set) {
        return new Set(initialExpanded);
      }
      // Если передан массив - создаем Set из него
      if (Array.isArray(initialExpanded)) {
        return new Set(initialExpanded);
      }
      // Для объектов или undefined создаем пустой Set
      return new Set();
    }
    return initialExpanded;
  });

  const toggle = useCallback((id) => {
    setExpanded(prev => {
      if (useSet) {
        const newSet = new Set(prev);
        if (newSet.has(id)) {
          newSet.delete(id);
        } else {
          newSet.add(id);
        }
        return newSet;
      } else {
        return {
          ...prev,
          [id]: !prev[id],
        };
      }
    });
  }, [useSet]);

  const isExpanded = useCallback((id) => {
    return useSet ? expanded.has(id) : expanded[id];
  }, [expanded, useSet]);

  const expandAll = useCallback((ids) => {
    if (useSet) {
      setExpanded(new Set(ids));
    } else {
      const newExpanded = {};
      ids.forEach(id => {
        newExpanded[id] = true;
      });
      setExpanded(newExpanded);
    }
  }, [useSet]);

  const collapseAll = useCallback(() => {
    setExpanded(useSet ? new Set() : {});
  }, [useSet]);

  return {
    expanded,
    toggle,
    isExpanded,
    expandAll,
    collapseAll,
  };
};

export default useAccordion;
