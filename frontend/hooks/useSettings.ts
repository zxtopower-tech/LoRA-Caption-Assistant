import { useState } from 'react';
import { DEFAULT_BULK_INSTRUCTIONS } from '../constants';

export const useSettings = () => {
  const [triggerWord, setTriggerWord] = useState<string>('MyStyle');
  const [datasetPrefix, setDatasetPrefix] = useState<string>('item');
  const [isCharacterTaggingEnabled, setIsCharacterTaggingEnabled] = useState<boolean>(false);
  const [characterShowName, setCharacterShowName] = useState<string>('');
  const [bulkGenerationInstructions, setBulkGenerationInstructions] = useState<string>(DEFAULT_BULK_INSTRUCTIONS);
  const [bulkInstructions, setBulkInstructions] = useState<string>('');
  const [autofitTextareas, setAutofitTextareas] = useState<boolean>(false);

  return {
    triggerWord,
    setTriggerWord,
    datasetPrefix,
    setDatasetPrefix,
    isCharacterTaggingEnabled,
    setIsCharacterTaggingEnabled,
    characterShowName,
    setCharacterShowName,
    bulkGenerationInstructions,
    setBulkGenerationInstructions,
    bulkInstructions,
    setBulkInstructions,
    autofitTextareas,
    setAutofitTextareas,
  };
};
