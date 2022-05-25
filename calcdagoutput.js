// unit testing and code coverage: use testcalcdagoutput.html and coverage tool of Chrome

/**
 * @type {(dag,node)=>Set}
 */
let getNodeInputsConnectedTo;

/**
 * @type {(dag, nodeInput)=>any}
 */
let getNodeOfNodeInput;

/**
 * @type {(dag, node)=>Set}
 */
let getInputsOfNode;

/**
 * @type {(dag,node,nodeInputsWithValues)=>any}
 */
let calcNodeOutput;

/**
 * @type {(dag:any)=>number}
 */
let getNumOfNodes;

/**
 * @type {(dag,node)=>Object}
 */
let getDefaultInputs;

/**
 * @param {(dag,node)=>Set} getNodeInputsConnectedToFn params:dag, node.
 * Output:nodeInput Set.
 *
 * @param {(dag, nodeInput)=>any} getNodeOfNodeInputFn params: dag, nodeInput.
 * Output: node.
 *
 * @param {(dag, node)=>Set} getInputsOfNodeFn params: dag, node.
 * Output:nodeInput Set.
 *
 * @param {(dag,node,nodeInputsWithValues)=>any} calcNodeOutputFn
 * params: dag, node, map of nodeInput to value.
 * Output: an output value
 *
 * @param {(dag:any)=>number} getNumOfNodesFn params:dag. Output: number.
 *
 * @param {(dag,node)=>Object} getDefaultInputsFn params:dag, node.
 * Output: map of output node to value.
 */
export function setConfigForCalcDagOutput(
  getNodeInputsConnectedToFn,
  getNodeOfNodeInputFn,
  getInputsOfNodeFn,
  calcNodeOutputFn,
  getNumOfNodesFn,
  getDefaultInputsFn
) {
  getNodeInputsConnectedTo = getNodeInputsConnectedToFn;
  getNodeOfNodeInput = getNodeOfNodeInputFn;
  getInputsOfNode = getInputsOfNodeFn;
  calcNodeOutput = calcNodeOutputFn;
  getNumOfNodes = getNumOfNodesFn;
  getDefaultInputs = getDefaultInputsFn;
}

/**
 * Algorithm:<br>
 * Input nodes already have values as given by the 'inputs' map where key is
 * node id and value is the input value.<br>
 * Then for the next level of nodes, give the inputs to the next level node.<br>
 * If the next level node already has a value for the corresponding input, then
 * also the graph is not valid and 2 outputs have been shorted to each other.<br>
 * If a next level node does not have all its inputs calculated, it means that
 * the un-calculated inputs are dangling inputs. We call a function that gets
 * the default value for the dangling input (or that could raise an exception).<br>
 * If all nodes have not had their output calculated then we raise an error as
 * well. This could be due to cyclical paths in the dag.
 * @param {Object} dag The DAG object, this is passed in so that multiple threads
 * can use this module.
 * @param {Object} inputs A map where key=nodeId of input node, value=input value
 */
export function calcDagOutput(dag, inputs) {
  let outputsOfPreviousLevel = inputs;
  let numOfNodesWhoseOutputWasCalculated = Object.keys(inputs).length;
  const finalOutputs = {};
  const foundInputsOfNextLevelNodes = {};
  while (Object.keys(outputsOfPreviousLevel).length > 0) {
    const outputsOfNextLevel = {};
    for (const [node, output] of Object.entries(outputsOfPreviousLevel)) {
      const nodeInputs = getNodeInputsConnectedTo(dag, node);
      if (nodeInputs.size === 0) {
        finalOutputs[node] = output;
      }
      for (const nodeInput of nodeInputs) {
        const nextLevelNode = getNodeOfNodeInput(dag, nodeInput);
        let calculatedInputs = foundInputsOfNextLevelNodes[nextLevelNode];
        if (calculatedInputs == null) {
          calculatedInputs = getDefaultInputs(dag, nextLevelNode);
          foundInputsOfNextLevelNodes[nextLevelNode] = calculatedInputs;
        }
        calculatedInputs[nodeInput] = output;
        const inputsOfNode = getInputsOfNode(dag, nextLevelNode);
        if (Object.keys(calculatedInputs).length == inputsOfNode.size) {
          outputsOfNextLevel[nextLevelNode] = calcNodeOutput(
            dag,
            nextLevelNode,
            calculatedInputs
          );
          numOfNodesWhoseOutputWasCalculated++;
          delete foundInputsOfNextLevelNodes[nextLevelNode];
        }
      }
    }
    outputsOfPreviousLevel = outputsOfNextLevel;
  }
  if (numOfNodesWhoseOutputWasCalculated != getNumOfNodes(dag)) {
    throw new Error("cyclic or disconnected nodes detected");
  }
  return finalOutputs;
}
