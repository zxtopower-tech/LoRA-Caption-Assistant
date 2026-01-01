/**
 * Workflow Node Parser
 * Utilities for parsing and modifying ComfyUI workflow JSON nodes
 */

// Type definitions
export interface WorkflowNode {
  inputs: Record<string, unknown>;
  class_type: string;
  _meta?: {
    title: string;
  };
}

export interface Workflow {
  [key: string]: WorkflowNode;
}

/**
 * Find nodes by their _meta.title property
 * @param workflow - The workflow JSON object
 * @param title - The title to search for
 * @returns Array of objects containing node ID and node data
 */
export function findNodesByMetaTitle(
  workflow: Workflow,
  title: string
): Array<{ id: string; node: WorkflowNode }> {
  const results: Array<{ id: string; node: WorkflowNode }> = [];

  for (const [id, node] of Object.entries(workflow)) {
    if (node._meta?.title === title) {
      results.push({ id, node });
    }
  }

  return results;
}

/**
 * Extract the int value from a node's inputs
 * @param node - The workflow node
 * @param defaultValue - Default value if int is not found or not a number
 * @returns The int value or default value
 */
export function extractNodeIntValue(
  node: WorkflowNode | undefined,
  defaultValue: number
): number {
  if (!node || !node.inputs) {
    return defaultValue;
  }

  const intValue = node.inputs.int;
  if (typeof intValue === 'number') {
    return intValue;
  }

  return defaultValue;
}

/**
 * Update a specific node's input value in the workflow
 * Creates a new workflow object without mutating the original
 * @param workflow - The original workflow
 * @param nodeId - The ID of the node to update
 * @param key - The input key to update
 * @param value - The new value
 * @returns A new workflow object with the updated node
 */
export function updateWorkflowNodeInput(
  workflow: Workflow,
  nodeId: string,
  key: string,
  value: unknown
): Workflow {
  const node = workflow[nodeId];
  if (!node) {
    return workflow;
  }

  // Create new node with updated input (immutable)
  const newNode: WorkflowNode = {
    ...node,
    inputs: {
      ...node.inputs,
      [key]: value,
    },
  };

  // Create new workflow with updated node
  return {
    ...workflow,
    [nodeId]: newNode,
  };
}

/**
 * Update all nodes that match the given _meta.title
 * @param workflow - The workflow object
 * @param title - The _meta.title to search for
 * @param inputKey - The input key to update (e.g., 'int', 'noise_seed')
 * @param value - The new value
 * @returns A new workflow object with updated nodes
 */
export function updateNodesByMetaTitle(
  workflow: Workflow,
  title: string,
  inputKey: string,
  value: unknown
): Workflow {
  let updatedWorkflow = workflow;
  const nodes = findNodesByMetaTitle(workflow, title);

  for (const { id } of nodes) {
    updatedWorkflow = updateWorkflowNodeInput(updatedWorkflow, id, inputKey, value);
  }

  return updatedWorkflow;
}

/**
 * Update text/caption in workflow (finds common keys like 'text', 'prompt', 'caption')
 * @param workflow - The workflow object
 * @param text - The text to inject
 * @returns A new workflow object with updated text
 */
export function updateTextInWorkflow(
  workflow: Workflow,
  text: string,
): Workflow {
  return updatePrimitiveInWorkflow(workflow, ['text', 'prompt', 'text_prompt', 'caption'], text);
}

/**
 * Update seed in workflow (finds common keys like 'seed', 'noise_seed', 'rand_seed')
 * @param workflow - The workflow object
 * @param seed - The seed value to inject
 * @returns A new workflow object with updated seed
 */
export function updateSeedInWorkflow(
  workflow: Workflow,
  seed: number,
): Workflow {
  return updatePrimitiveInWorkflow(workflow, ['seed', 'noise_seed', 'rand_seed'], seed);
}

/**
 * Update steps in workflow (finds common keys like 'steps', 'sampling_steps', 'denoise_steps')
 * @param workflow - The workflow object
 * @param steps - The steps value to inject
 * @returns A new workflow object with updated steps
 */
export function updateStepsInWorkflow(
  workflow: Workflow,
  steps: number,
): Workflow {
  return updatePrimitiveInWorkflow(workflow, ['steps', 'sampling_steps', 'denoise_steps'], steps);
}

/**
 * Update EmptySD3LatentImage node dimensions
 * @param workflow - The workflow object
 * @param width - The width to set
 * @param height - The height to set
 * @returns A new workflow object with updated dimensions
 */
export function updateDimensionsInWorkflow(
  workflow: Workflow,
  width: number,
  height: number,
): Workflow {
  let updatedWorkflow = workflow;

  for (const [nodeId, node] of Object.entries(workflow)) {
    if (node.class_type === 'EmptySD3LatentImage') {
      updatedWorkflow = updateWorkflowNodeInput(updatedWorkflow, nodeId, 'width', width);
      updatedWorkflow = updateWorkflowNodeInput(updatedWorkflow, nodeId, 'height', height);
    }
  }

  return updatedWorkflow;
}

/**
 * Generic helper to update primitive values in workflow
 * Searches for any key matching the keyPaths and updates the first occurrence
 * @param workflow - The workflow object
 * @param keyPaths - Array of possible key names to search for
 * @param value - The value to inject (string or number)
 * @returns A new workflow object with the updated value
 */
function updatePrimitiveInWorkflow(
  workflow: Workflow,
  keyPaths: string[],
  value: string | number,
): Workflow {
  // Deep clone the workflow to maintain immutability
  const workflowCopy = JSON.parse(JSON.stringify(workflow));

  const searchAndReplace = (obj: any): boolean => {
    if (typeof obj === 'object' && obj !== null && !Array.isArray(obj)) {
      for (const [key, val] of Object.entries(obj)) {
        if (keyPaths.includes(key) && typeof val === typeof value) {
          obj[key] = value;
          return true;
        }
        if (searchAndReplace(val)) return true;
      }
    } else if (Array.isArray(obj)) {
      for (const item of obj) {
        if (searchAndReplace(item)) return true;
      }
    }
    return false;
  };

  searchAndReplace(workflowCopy);
  return workflowCopy as Workflow;
}
