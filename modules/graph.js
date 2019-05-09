
/*
Graph()

Constructs a graph of AudioObjects. The returned object has two proerties:

- `nodes`
- `connections`

*/

/*
.nodes()

An array of context graph nodes.
*/

/*
.connections()

An array of context graph connections.
*/

/*
.create(type, settings)

Create a new node of `type`.
*/

/*
.get(id)

Return the plugin with `id`, or undefined.
*/

import { has, get, nothing }  from '../../fn/module.js';
import { print }  from './utilities/print.js';
import { generateUnique }  from './utilities/utilities.js';
import Node       from './node.js';
import Connection from './connection.js';

const assign    = Object.assign;
const define    = Object.defineProperties;

function addConnection(graph, setting) {
	new Connection(graph, setting.source, setting.target, setting.output, setting.input);
	return graph;
}

export default function Graph(context, requests, data, api) {
	const graph       = this;
    const nodes       = [];
    const connections = [];

	define(this, {
		nodes:       { enumerable: true, value: nodes },
		connections: { enumerable: true, value: connections }
	});

    // Load nodes
	const promise = Promise.all(
        data.nodes ?
            data.nodes.map(function(data) {
                return (requests[data.type] || requests.default)(context, data, api)
                .then(function(module) {
                    nodes.push(new Node(graph, data.type, data.id, module));
                });
            }) :
            nothing
    )
    .then(function(loaders) {
        if (data.connections) {
            data.connections.reduce(addConnection, graph)
        }

        print('graph', graph.nodes.length + ' nodes, ' + graph.connections.length + ' connections');

        return graph;
    });

	this.ready = promise.then.bind(promise);
}

assign(Graph.prototype, {
	get: function(id) {
		//console.log('GET', id, this.nodes.find(has('id', id)));
		return this.nodes.find(has('id', id)).data;
	},

	identify: function(data) {
		return this.nodes.find(has('data', data)).id;
	},

	create: function(type, settings) {
		const plugin = {};
		const id = generateUnique('id', this.nodes.map(get('id')));
		this.nodes.push(new Node(this, type, id, plugin));
		return plugin;
	},

	Connection: function(source, target, output, input) {
		return new Connection(this, source, target, output, input);
	}
});
