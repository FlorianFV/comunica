import { ActionContext, Actor, IAction, IActorArgs, IActorOutput, IActorTest } from '@comunica/core';
import { AsyncIterator } from 'asynciterator';
import { AsyncReiterable } from 'asyncreiterable';
import * as RDF from 'rdf-js';
import { Algebra } from 'sparqlalgebrajs';

/**
 * @type {string} Context entry for data sources.
 * @value {DataSources} An array or stream of sources.
 */
export const KEY_CONTEXT_SOURCES = '@comunica/bus-rdf-resolve-quad-pattern:sources';
/**
 * @type {string} Context entry for a data source.
 * @value {IDataSource} A source.
 */
export const KEY_CONTEXT_SOURCE = '@comunica/bus-rdf-resolve-quad-pattern:source';

export function isDataSourceRawType(dataSource: IDataSource): dataSource is string | RDF.Source {
  return typeof dataSource === 'string' || 'match' in dataSource;
}
export function getDataSourceType(dataSource: IDataSource): string | undefined {
  if (typeof dataSource === 'string') {
    return '';
  }
  return 'match' in dataSource ? 'rdfjsSource' : dataSource.type;
}
export function getDataSourceValue(dataSource: IDataSource): string | RDF.Source {
  return isDataSourceRawType(dataSource) ? dataSource : dataSource.value;
}
export function getDataSourceContext(dataSource: IDataSource, context: ActionContext): ActionContext {
  if (typeof dataSource === 'string' || 'match' in dataSource || !dataSource.context) {
    return context;
  }
  return context.merge(dataSource.context);
}

/**
 * A comunica actor for rdf-resolve-quad-pattern events.
 *
 * Actor types:
 * * Input:  IActionRdfResolveQuadPattern:      A quad pattern and an optional context.
 * * Test:   <none>
 * * Output: IActorRdfResolveQuadPatternOutput: The resulting quad stream and optional metadata.
 *
 * @see IActionRdfResolveQuadPattern
 * @see IActorRdfResolveQuadPatternOutput
 */
export abstract class ActorRdfResolveQuadPattern extends Actor<IActionRdfResolveQuadPattern, IActorTest,
IActorRdfResolveQuadPatternOutput> {
  public constructor(args: IActorArgs<IActionRdfResolveQuadPattern, IActorTest, IActorRdfResolveQuadPatternOutput>) {
    super(args);
  }

  /**
   * Get the sources from the given context.
   * @param {ActionContext} context An optional context.
   * @return {IDataSource[]} The array of sources or undefined.
   */
  protected getContextSources(context?: ActionContext): IDataSource[] | undefined {
    return context ? context.get(KEY_CONTEXT_SOURCES) : undefined;
  }

  /**
   * Get the source from the given context.
   * @param {ActionContext} context An optional context.
   * @return {IDataSource} The source or undefined.
   */
  protected getContextSource(context?: ActionContext): IDataSource | undefined {
    return context ? context.get(KEY_CONTEXT_SOURCE) : undefined;
  }

  /**
   * Get the source's raw URL value from the given context.
   * @param {IDataSource} source A source.
   * @return {string} The URL or null.
   */
  protected getContextSourceUrl(source?: IDataSource): string | undefined {
    if (source) {
      let fileUrl = getDataSourceValue(source);
      if (typeof fileUrl === 'string') {
        // Remove hashes from source
        const hashPosition = fileUrl.indexOf('#');
        if (hashPosition >= 0) {
          fileUrl = fileUrl.slice(0, hashPosition);
        }

        return fileUrl;
      }
    }
  }

  /**
   * Check if the given context has a single source.
   * @param {ActionContext} context An optional context.
   * @return {boolean} If the given context has a single source of the given type.
   */
  protected hasContextSingleSource(context?: ActionContext): boolean {
    const source = this.getContextSource(context);
    return Boolean(source && (isDataSourceRawType(source) || source.value));
  }

  /**
   * Check if the given context has a single source of the given type.
   * @param {string} requiredType The required source type name.
   * @param {ActionContext} context An optional context.
   * @return {boolean} If the given context has a single source of the given type.
   */
  protected hasContextSingleSourceOfType(requiredType: string, context?: ActionContext): boolean {
    const source = this.getContextSource(context);
    return Boolean(source && getDataSourceType(source) === requiredType && getDataSourceValue(source));
  }
}

export type IDataSource = string | RDF.Source | {
  type?: string;
  value: string | RDF.Source;
  context?: ActionContext;
};
export type DataSources = AsyncReiterable<IDataSource>;

export interface IActionRdfResolveQuadPattern extends IAction {
  /**
   * The quad pattern to resolve.
   */
  pattern: Algebra.Pattern;
}

export interface IActorRdfResolveQuadPatternOutput extends IActorOutput {
  /**
   * The resulting quad data stream.
   */
  data: AsyncIterator<RDF.Quad> & RDF.Stream;
  /**
   * Callback that returns a promise that resolves to the metadata about the stream.
   * This can contain things like the estimated number of total stream elements,
   * or the order in which the bindings appear.
   * This callback can be invoked multiple times.
   * The actors that return this metadata will make sure that multiple calls properly cache this promise.
   * Metadata will not be collected until this callback is invoked.
   */
  metadata: () => Promise<{[id: string]: any}>;
}
