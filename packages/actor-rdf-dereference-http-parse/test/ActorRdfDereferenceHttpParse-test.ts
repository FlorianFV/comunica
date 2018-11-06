import {ActorRdfDereference} from "@comunica/bus-rdf-dereference";
import {Bus} from "@comunica/core";
import {MediatorRace} from "@comunica/mediator-race";
import {EmptyIterator} from "asynciterator";
import "isomorphic-fetch";
import {PassThrough, Readable} from "stream";
import {ActorRdfDereferenceHttpParse} from "../lib/ActorRdfDereferenceHttpParse";

describe('ActorRdfDereferenceHttpParse', () => {
  let bus;
  let mediatorHttp;
  let mediatorRdfParse;
  let mediaMappings;

  beforeEach(() => {
    bus = new Bus({ name: 'bus' });
    mediatorHttp = new MediatorRace({ name: 'mediator-http', bus: new Bus({ name: 'bus-http' }) });
    mediatorRdfParse = new MediatorRace({ name: 'mediator-parse', bus: new Bus({ name: 'bus-parse' }) });
    mediaMappings = {
      x: 'y',
    };
  });

  describe('The ActorRdfDereferenceHttpParse module', () => {
    it('should be a function', () => {
      expect(ActorRdfDereferenceHttpParse).toBeInstanceOf(Function);
    });

    it('should be a ActorRdfDereferenceHttpParse constructor', () => {
      expect(new (<any> ActorRdfDereferenceHttpParse)(
        { name: 'actor', bus, mediatorHttp, mediatorRdfParse, mediaMappings }))
        .toBeInstanceOf(ActorRdfDereferenceHttpParse);
      expect(new (<any> ActorRdfDereferenceHttpParse)(
        { name: 'actor', bus, mediatorHttp, mediatorRdfParse, mediaMappings }))
        .toBeInstanceOf(ActorRdfDereference);
    });

    it('should not be able to create new ActorRdfDereferenceHttpParse objects without \'new\'', () => {
      expect(() => { (<any> ActorRdfDereferenceHttpParse)(); }).toThrow();
    });
  });

  describe('An ActorRdfDereferenceHttpParse instance', () => {
    let actor: ActorRdfDereferenceHttpParse;

    beforeEach(() => {
      mediatorRdfParse.mediate = (action) => {
        if (action.mediaTypes) {
          return { mediaTypes: { a: 1.0 }};
        } else {
          if (action.handleMediaType === 'error') {
            return Promise.reject(new Error('Invalid media type'));
          }
          if (action.handleMediaType === 'errorstream') {
            const quads = new Readable();
            quads._read = () => {
              quads.emit('error', new Error('rdf dereference http parse stream error'));
            };
            return { handle: { quads, triples: true }};
          }
          return { handle: { quads: 'fine', triples: true }};
        }
      };
      mediatorHttp.mediate = (action) => {
        if (action.input.indexOf('promiseError') >= 0) {
          return Promise.reject(new Error('rdf dereference http parser error'));
        }
        const status: number = action.input.startsWith('https://www.google.com/') ? 200 : 400;
        const extension = action.input.lastIndexOf('.') > action.input.lastIndexOf('/');
        return {
          body: action.input === 'https://www.google.com/noweb'
          ? require('node-web-streams').toWebReadableStream(new PassThrough()) : new PassThrough(),
          headers: {
            get: () => action.input.indexOf('parseerrorstream') >= 0 ? 'errorstream'
              : action.input.indexOf('parseerror') >= 0 ? 'error' : 'a; charset=utf-8',
            has: () => !extension,
          },
          status,
          url: extension ? action.input : 'https://www.google.com/index.html',
        };
      };
      actor = new ActorRdfDereferenceHttpParse({ name: 'actor', bus, mediatorHttp, mediatorRdfParse, mediaMappings });
    });

    it('should test on https', () => {
      return expect(actor.test({ url: 'https://www.google.com/' })).resolves.toBeTruthy();
    });

    it('should test on http', () => {
      return expect(actor.test({ url: 'http://www.google.com/' })).resolves.toBeTruthy();
    });

    it('should not test on ftp', () => {
      return expect(actor.test({ url: 'ftp://www.google.com/' })).rejects.toBeTruthy();
    });

    it('should stringify empty media types to any', () => {
      return expect(actor.mediaTypesToAcceptString({})).toEqual('*/*');
    });

    it('should stringify a single media type', () => {
      return expect(actor.mediaTypesToAcceptString({ a: 1.0 })).toEqual('a');
    });

    it('should stringify a single prioritized media type', () => {
      return expect(actor.mediaTypesToAcceptString({ a: 0.5 })).toEqual('a;q=0.5');
    });

    it('should stringify three media types', () => {
      return expect(actor.mediaTypesToAcceptString({ a: 1.0, b: 1.0, c: 1.0 })).toEqual('a, b, c');
    });

    it('should stringify three prioritized media types', () => {
      return expect(actor.mediaTypesToAcceptString({ a: 1.0, b: 0.8, c: 0.2 }))
        .toEqual('a, b;q=0.8, c;q=0.2');
    });

    it('should run with a web stream', () => {
      return expect(actor.run({ url: 'https://www.google.com/' })).resolves
        .toMatchObject({ pageUrl: 'https://www.google.com/index.html', quads: 'fine', triples: true });
    });

    it('should run with a web stream with a known extension', () => {
      return expect(actor.run({ url: 'https://www.google.com/abc.x' })).resolves
        .toMatchObject({ pageUrl: 'https://www.google.com/abc.x', quads: 'fine', triples: true });
    });

    it('should run with a web stream with a known extension', () => {
      return expect(actor.run({ url: 'https://www.google.com/abc.y' })).resolves
        .toMatchObject({ pageUrl: 'https://www.google.com/abc.y', quads: 'fine', triples: true });
    });

    it('should run with a Node.JS stream', () => {
      return expect(actor.run({ url: 'https://www.google.com/noweb' })).resolves
        .toMatchObject({ pageUrl: 'https://www.google.com/index.html', quads: 'fine', triples: true });
    });

    it('should not run on a http mediator error', () => {
      return expect(actor.run({ url: 'promiseError' })).rejects.toBeTruthy();
    });

    it('should run on a http mediator error with silent errors', () => {
      return expect(actor.run({ url: 'promiseError', silenceErrors: true })).resolves
        .toMatchObject({ pageUrl: 'promiseError', quads: new EmptyIterator(), triples: true });
    });

    it('should not run on a 404', () => {
      return expect(actor.run({ url: 'https://www.nogoogle.com/notfound' })).rejects.toBeTruthy();
    });

    it('should run on a 404 with silent errors', () => {
      return expect(actor.run({ url: 'https://www.nogoogle.com/notfound', silenceErrors: true })).resolves
        .toMatchObject({ pageUrl: 'https://www.google.com/index.html', quads: new EmptyIterator(), triples: true });
    });

    it('should not run on a parse error', () => {
      return expect(actor.run({ url: 'https://www.google.com/parseerror' })).rejects.toBeTruthy();
    });

    it('should run on a parse error with silent errors', async () => {
      return expect(actor.run({ url: 'https://www.google.com/parseerror', silenceErrors: true })).resolves
        .toMatchObject({ pageUrl: 'https://www.google.com/index.html', quads: new EmptyIterator(), triples: true });
    });

    it('should run and silence parsing stream errors with silent errors', async () => {
      const output = await actor.run({ url: 'https://www.google.com/parseerrorstream', silenceErrors: true });
      (<any> output.quads)._read();
      return expect(output).toBeTruthy();
    });
  });
});
