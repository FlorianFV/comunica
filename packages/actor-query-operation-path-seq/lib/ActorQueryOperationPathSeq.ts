import { ActorAbstractPath } from '@comunica/actor-abstract-path';
import {
  ActorQueryOperation,
  Bindings, IActorQueryOperationOutput, IActorQueryOperationOutputBindings,
  IActorQueryOperationTypedMediatedArgs,
} from '@comunica/bus-query-operation';
import { ActorRdfJoin, IActionRdfJoin } from '@comunica/bus-rdf-join';
import { ActionContext, Mediator } from '@comunica/core';
import { IMediatorTypeIterations } from '@comunica/mediatortype-iterations';

import { termToString } from 'rdf-string';
import { Algebra } from 'sparqlalgebrajs';
/**
 * A comunica Path Seq Query Operation Actor.
 */
export class ActorQueryOperationPathSeq extends ActorAbstractPath {
  public readonly mediatorJoin: Mediator<ActorRdfJoin,
  IActionRdfJoin, IMediatorTypeIterations, IActorQueryOperationOutput>;

  public constructor(args: IActorQueryOperationPathSeq) {
    super(args, Algebra.types.SEQ);
  }

  public async runOperation(path: Algebra.Path, context: ActionContext): Promise<IActorQueryOperationOutputBindings> {
    const predicate = <Algebra.Seq> path.predicate;
    const variable = this.generateVariable(path);
    const varName = termToString(variable);

    const subOperations: IActorQueryOperationOutputBindings[] = (await Promise.all([
      this.mediatorQueryOperation.mediate({
        context, operation: ActorAbstractPath.FACTORY.createPath(path.subject, predicate.left, variable, path.graph),
      }),
      this.mediatorQueryOperation.mediate({
        context, operation: ActorAbstractPath.FACTORY.createPath(variable, predicate.right, path.object, path.graph),
      }),
    ])).map(op => ActorQueryOperation.getSafeBindings(op));

    const join = ActorQueryOperation.getSafeBindings(await this.mediatorJoin.mediate({ entries: subOperations }));
    // Remove the generated variable from the bindings
    const bindingsStream = join.bindingsStream.transform<Bindings>({
      transform(item, next, push) {
        push(item.delete(varName));
        next();
      },
    });

    // Remove the generated variable from the list of variables
    const variables = join.variables;
    const indexOfVar = variables.indexOf(varName);
    variables.splice(indexOfVar, 1);
    return { type: 'bindings', bindingsStream, variables };
  }
}

export interface IActorQueryOperationPathSeq extends IActorQueryOperationTypedMediatedArgs {
  mediatorJoin: Mediator<ActorRdfJoin, IActionRdfJoin, IMediatorTypeIterations, IActorQueryOperationOutput>;
}
