import { useProjectContext } from '../contexts/ProjectContext';

export const useProject = () => {
  return useProjectContext();
};
