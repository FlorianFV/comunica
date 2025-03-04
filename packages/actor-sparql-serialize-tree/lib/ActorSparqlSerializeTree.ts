import { Readable } from 'stream';
import { IActorQueryOperationOutputBindings, BindingsStream } from '@comunica/bus-query-operation';
import { ActorSparqlSerializeFixedMediaTypes, IActionSparqlSerialize,
  IActorSparqlSerializeFixedMediaTypesArgs, IActorSparqlSerializeOutput } from '@comunica/bus-sparql-serialize';
import { ActionContext, ensureActionContext } from '@comunica/core';
import * as RDF from 'rdf-js';
import { Converter, IConverterSettings, ISchema } from 'sparqljson-to-tree';

/**
 * A comunica Tree SPARQL Serialize Actor.
 */
export class ActorSparqlSerializeTree extends ActorSparqlSerializeFixedMediaTypes
  implements IActorSparqlSerializeFixedMediaTypesArgs {
  public constructor(args: IActorSparqlSerializeFixedMediaTypesArgs) {
    super(args);
  }

  /**
   *
   * @param {BindingsStream} bindingsStream
   * @param context
   * @param {IConverterSettings} converterSettings
   * @return {Promise<string>}
   */
  public static bindingsStreamToGraphQl(bindingsStream: BindingsStream,
    context: ActionContext | {[key: string]: any} | undefined,
    converterSettings?: IConverterSettings): Promise<string> {
    const actionContext: ActionContext = ensureActionContext(context);
    return new Promise((resolve, reject) => {
      const bindingsArray: {[key: string]: RDF.Term}[] = [];
      const converter: Converter = new Converter(converterSettings);

      const schema: ISchema = {
        singularizeVariables: actionContext.get('@comunica/actor-init-sparql:singularizeVariables') || {},
      };

      bindingsStream.on('error', reject);
      bindingsStream.on('data', bindings => {
        const rawBindings = bindings.toJS();
        const reKeyedBindings: {[key: string]: RDF.Term} = {};
        // Removes the '?' prefix
        for (const key in rawBindings) {
          reKeyedBindings[key.slice(1)] = rawBindings[key];
        }
        bindingsArray.push(reKeyedBindings);
      });
      bindingsStream.on('end', () => {
        resolve(converter.bindingsToTree(bindingsArray, schema));
      });
    });
  }

  public async testHandleChecked(action: IActionSparqlSerialize): Promise<boolean> {
    if (action.type !== 'bindings') {
      throw new Error('This actor can only handle bindings streams.');
    }
    return true;
  }

  public async runHandle(action: IActionSparqlSerialize, mediaType: string): Promise<IActorSparqlSerializeOutput> {
    const data = new Readable();
    data._read = () => {
      // Do nothing
    };

    const resultStream: BindingsStream = (<IActorQueryOperationOutputBindings> action).bindingsStream;
    resultStream.on('error', error => data.emit('error', error));
    ActorSparqlSerializeTree.bindingsStreamToGraphQl(resultStream, action.context, { materializeRdfJsTerms: true })
      .then((result: any) => {
        data.push(JSON.stringify(result, null, '  '));
        data.push(null);
      })
      .catch(error => data.emit('error', error));

    return { data };
  }
}
