var LOCAL_RBAC_TEMPLATES = {noAccess:(function() {
  var child0 = (function() {
    return {
      meta: {
        "revision": "Ember@2.9.1",
        "loc": {
          "source": null,
          "start": {
            "line": 18,
            "column": 10
          },
          "end": {
            "line": 18,
            "column": 40
          }
        }
      },
      isEmpty: false,
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createTextNode("Verificando...");
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes() { return []; },
      statements: [

      ],
      locals: [],
      templates: []
    };
  }());
  var child1 = (function() {
    return {
      meta: {
        "revision": "Ember@2.9.1",
        "loc": {
          "source": null,
          "start": {
            "line": 18,
            "column": 40
          },
          "end": {
            "line": 18,
            "column": 64
          }
        }
      },
      isEmpty: false,
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createTextNode("Verificar acesso");
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes() { return []; },
      statements: [

      ],
      locals: [],
      templates: []
    };
  }());
  var child2 = (function() {
    return {
      meta: {
        "revision": "Ember@2.9.1",
        "loc": {
          "source": null,
          "start": {
            "line": 22,
            "column": 6
          },
          "end": {
            "line": 22,
            "column": 79
          }
        }
      },
      isEmpty: false,
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("p");
        dom.setAttribute(el1,"class","text-muted r-mt20");
        dom.setAttribute(el1,"role","status");
        var el2 = dom.createComment("");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var morphs = new Array(1);
        morphs[0] = dom.createMorphAt(dom.childAt(fragment, [0]),0,0);
        return morphs;
      },
      statements: [
        ["content","message",["loc",[null,[22,64],[22,75]]],0,0,0,0]
      ],
      locals: [],
      templates: []
    };
  }());
  return {
    meta: {
      "revision": "Ember@2.9.1",
      "loc": {
        "source": null,
        "start": {
          "line": 1,
          "column": 0
        },
        "end": {
          "line": 27,
          "column": 0
        }
      }
    },
    isEmpty: false,
    arity: 0,
    cachedFragment: null,
    hasRendered: false,
    buildFragment: function buildFragment(dom) {
      var el0 = dom.createDocumentFragment();
      var el1 = dom.createComment("");
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("\n");
      dom.appendChild(el0, el1);
      var el1 = dom.createElement("main");
      dom.setAttribute(el1,"class","clearfix");
      var el2 = dom.createTextNode("\n  ");
      dom.appendChild(el1, el2);
      var el2 = dom.createElement("section");
      dom.setAttribute(el2,"class","header clearfix");
      var el3 = dom.createTextNode("\n    ");
      dom.appendChild(el2, el3);
      var el3 = dom.createElement("h1");
      var el4 = dom.createTextNode("Environments");
      dom.appendChild(el3, el4);
      dom.appendChild(el2, el3);
      var el3 = dom.createTextNode("\n  ");
      dom.appendChild(el2, el3);
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("\n  ");
      dom.appendChild(el1, el2);
      var el2 = dom.createElement("section");
      var el3 = dom.createTextNode("\n    ");
      dom.appendChild(el2, el3);
      var el3 = dom.createElement("div");
      dom.setAttribute(el3,"class","banner bg-info");
      var el4 = dom.createTextNode("\n      ");
      dom.appendChild(el3, el4);
      var el4 = dom.createElement("div");
      dom.setAttribute(el4,"class","banner-icon");
      var el5 = dom.createElement("i");
      dom.setAttribute(el5,"class","icon icon-info");
      dom.appendChild(el4, el5);
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode("\n      ");
      dom.appendChild(el3, el4);
      var el4 = dom.createElement("div");
      dom.setAttribute(el4,"class","banner-message");
      var el5 = dom.createElement("p");
      var el6 = dom.createTextNode("Seu usuário ainda não tem acesso a nenhum environment.");
      dom.appendChild(el5, el6);
      dom.appendChild(el4, el5);
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode("\n    ");
      dom.appendChild(el3, el4);
      dom.appendChild(el2, el3);
      var el3 = dom.createTextNode("\n    ");
      dom.appendChild(el2, el3);
      var el3 = dom.createElement("div");
      dom.setAttribute(el3,"class","text-center r-mt50 r-mb50");
      var el4 = dom.createTextNode("\n      ");
      dom.appendChild(el3, el4);
      var el4 = dom.createElement("i");
      dom.setAttribute(el4,"class","icon icon-environment text-muted");
      dom.setAttribute(el4,"style","font-size:48px");
      dom.setAttribute(el4,"aria-hidden","true");
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode("\n      ");
      dom.appendChild(el3, el4);
      var el4 = dom.createElement("h2");
      var el5 = dom.createTextNode("Acesso aguardando liberação");
      dom.appendChild(el4, el5);
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode("\n      ");
      dom.appendChild(el3, el4);
      var el4 = dom.createElement("p");
      dom.setAttribute(el4,"class","text-muted");
      var el5 = dom.createTextNode("Peça a um administrador para incluir seu usuário em um grupo com as permissões necessárias.");
      dom.appendChild(el4, el5);
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode("\n      ");
      dom.appendChild(el3, el4);
      var el4 = dom.createElement("p");
      dom.setAttribute(el4,"class","text-muted");
      var el5 = dom.createTextNode("Nenhum environment será criado automaticamente para sua conta.");
      dom.appendChild(el4, el5);
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode("\n      ");
      dom.appendChild(el3, el4);
      var el4 = dom.createElement("div");
      dom.setAttribute(el4,"class","r-mt20");
      var el5 = dom.createTextNode("\n        ");
      dom.appendChild(el4, el5);
      var el5 = dom.createElement("button");
      dom.setAttribute(el5,"type","button");
      dom.setAttribute(el5,"class","btn btn-primary");
      var el6 = dom.createTextNode("\n          ");
      dom.appendChild(el5, el6);
      var el6 = dom.createComment("");
      dom.appendChild(el5, el6);
      var el6 = dom.createTextNode("\n        ");
      dom.appendChild(el5, el6);
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n        ");
      dom.appendChild(el4, el5);
      var el5 = dom.createElement("button");
      dom.setAttribute(el5,"type","button");
      dom.setAttribute(el5,"class","btn btn-link");
      var el6 = dom.createTextNode("Sair");
      dom.appendChild(el5, el6);
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n      ");
      dom.appendChild(el4, el5);
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode("\n      ");
      dom.appendChild(el3, el4);
      var el4 = dom.createComment("");
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode("\n    ");
      dom.appendChild(el3, el4);
      dom.appendChild(el2, el3);
      var el3 = dom.createTextNode("\n  ");
      dom.appendChild(el2, el3);
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("\n");
      dom.appendChild(el1, el2);
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("\n");
      dom.appendChild(el0, el1);
      var el1 = dom.createComment("");
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("\n");
      dom.appendChild(el0, el1);
      return el0;
    },
    buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
      var element0 = dom.childAt(fragment, [2, 3, 3]);
      var element1 = dom.childAt(element0, [9]);
      var element2 = dom.childAt(element1, [1]);
      var element3 = dom.childAt(element1, [3]);
      var morphs = new Array(7);
      morphs[0] = dom.createMorphAt(fragment,0,0,contextualElement);
      morphs[1] = dom.createAttrMorph(element2, 'disabled');
      morphs[2] = dom.createElementMorph(element2);
      morphs[3] = dom.createMorphAt(element2,1,1);
      morphs[4] = dom.createElementMorph(element3);
      morphs[5] = dom.createMorphAt(element0,11,11);
      morphs[6] = dom.createMorphAt(fragment,4,4,contextualElement);
      dom.insertBoundary(fragment, 0);
      return morphs;
    },
    statements: [
      ["inline","page-header",[],["currentPath","no-access"],["loc",[null,[1,0],[1,39]]],0,0],
      ["attribute","disabled",["get","checking",["loc",[null,[17,65],[17,73]]],0,0,0,0],0,0,0,0],
      ["element","action",["checkAccess"],[],["loc",[null,[17,76],[17,100]]],0,0],
      ["block","if",[["get","checking",["loc",[null,[18,16],[18,24]]],0,0,0,0]],[],0,1,["loc",[null,[18,10],[18,71]]]],
      ["element","action",["logout"],[],["loc",[null,[20,51],[20,70]]],0,0],
      ["block","if",[["get","message",["loc",[null,[22,12],[22,19]]],0,0,0,0]],[],2,null,["loc",[null,[22,6],[22,86]]]],
      ["content","page-footer",["loc",[null,[26,0],[26,15]]],0,0,0,0]
    ],
    locals: [],
    templates: [child0, child1, child2]
  };
}()),localGroups:(function() {
  var child0 = (function() {
    return {
      meta: {
        "revision": "Ember@2.9.1",
        "loc": {
          "source": null,
          "start": {
            "line": 5,
            "column": 4
          },
          "end": {
            "line": 5,
            "column": 207
          }
        }
      },
      isEmpty: false,
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("div");
        var el2 = dom.createElement("div");
        dom.setAttribute(el2,"class","banner-icon");
        var el3 = dom.createElement("i");
        dom.setAttribute(el3,"class","icon icon-info");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("div");
        dom.setAttribute(el2,"class","banner-message");
        var el3 = dom.createElement("p");
        dom.setAttribute(el3,"role","status");
        var el4 = dom.createComment("");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var element10 = dom.childAt(fragment, [0]);
        var morphs = new Array(2);
        morphs[0] = dom.createAttrMorph(element10, 'class');
        morphs[1] = dom.createMorphAt(dom.childAt(element10, [1, 0]),0,0);
        return morphs;
      },
      statements: [
        ["attribute","class",["concat",["banner ",["subexpr","if",[["get","error",["loc",[null,[5,43],[5,48]]],0,0,0,0],"bg-danger","bg-info"],[],["loc",[null,[5,38],[5,72]]],0,0]],0,0,0,0,0],0,0,0,0],
        ["content","message",["loc",[null,[5,180],[5,191]]],0,0,0,0]
      ],
      locals: [],
      templates: []
    };
  }());
  var child1 = (function() {
    return {
      meta: {
        "revision": "Ember@2.9.1",
        "loc": {
          "source": null,
          "start": {
            "line": 10,
            "column": 10
          },
          "end": {
            "line": 10,
            "column": 162
          }
        }
      },
      isEmpty: false,
      arity: 1,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("li");
        dom.setAttribute(el1,"class","r-mb10");
        var el2 = dom.createElement("a");
        dom.setAttribute(el2,"class","hand");
        var el3 = dom.createElement("i");
        dom.setAttribute(el3,"class","icon icon-users");
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode(" ");
        dom.appendChild(el2, el3);
        var el3 = dom.createComment("");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var element9 = dom.childAt(fragment, [0, 0]);
        var morphs = new Array(2);
        morphs[0] = dom.createElementMorph(element9);
        morphs[1] = dom.createMorphAt(element9,2,2);
        return morphs;
      },
      statements: [
        ["element","action",["editGroup",["get","group",["loc",[null,[10,99],[10,104]]],0,0,0,0]],[],["loc",[null,[10,78],[10,106]]],0,0],
        ["content","group.name",["loc",[null,[10,139],[10,153]]],0,0,0,0]
      ],
      locals: ["group"],
      templates: []
    };
  }());
  var child2 = (function() {
    return {
      meta: {
        "revision": "Ember@2.9.1",
        "loc": {
          "source": null,
          "start": {
            "line": 10,
            "column": 162
          },
          "end": {
            "line": 10,
            "column": 222
          }
        }
      },
      isEmpty: false,
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("li");
        dom.setAttribute(el1,"class","text-muted");
        var el2 = dom.createTextNode("Nenhum grupo cadastrado.");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes() { return []; },
      statements: [

      ],
      locals: [],
      templates: []
    };
  }());
  var child3 = (function() {
    return {
      meta: {
        "revision": "Ember@2.9.1",
        "loc": {
          "source": null,
          "start": {
            "line": 19,
            "column": 10
          },
          "end": {
            "line": 19,
            "column": 202
          }
        }
      },
      isEmpty: false,
      arity: 1,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("label");
        dom.setAttribute(el1,"class","r-mr20 inline-block");
        var el2 = dom.createComment("");
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode(" ");
        dom.appendChild(el1, el2);
        var el2 = dom.createComment("");
        dom.appendChild(el1, el2);
        var el2 = dom.createTextNode(" ");
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("span");
        dom.setAttribute(el2,"class","text-muted");
        var el3 = dom.createTextNode("(");
        dom.appendChild(el2, el3);
        var el3 = dom.createComment("");
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode(")");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var element8 = dom.childAt(fragment, [0]);
        var morphs = new Array(3);
        morphs[0] = dom.createMorphAt(element8,0,0);
        morphs[1] = dom.createMorphAt(element8,2,2);
        morphs[2] = dom.createMorphAt(dom.childAt(element8, [4]),1,1);
        return morphs;
      },
      statements: [
        ["inline","input",[],["type","checkbox","checked",["subexpr","@mut",[["get","member.selected",["loc",[null,[19,106],[19,121]]],0,0,0,0]],[],[],0,0]],["loc",[null,[19,74],[19,123]]],0,0],
        ["content","member.name",["loc",[null,[19,124],[19,139]]],0,0,0,0],
        ["content","member.displayId",["loc",[null,[19,166],[19,186]]],0,0,0,0]
      ],
      locals: ["member"],
      templates: []
    };
  }());
  var child4 = (function() {
    return {
      meta: {
        "revision": "Ember@2.9.1",
        "loc": {
          "source": null,
          "start": {
            "line": 19,
            "column": 202
          },
          "end": {
            "line": 19,
            "column": 262
          }
        }
      },
      isEmpty: false,
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("p");
        dom.setAttribute(el1,"class","text-muted");
        var el2 = dom.createTextNode("Nenhum usuário disponível.");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes() { return []; },
      statements: [

      ],
      locals: [],
      templates: []
    };
  }());
  var child5 = (function() {
    return {
      meta: {
        "revision": "Ember@2.9.1",
        "loc": {
          "source": null,
          "start": {
            "line": 23,
            "column": 10
          },
          "end": {
            "line": 31,
            "column": 20
          }
        }
      },
      isEmpty: false,
      arity: 1,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("tr");
        var el2 = dom.createElement("td");
        var el3 = dom.createComment("");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        var el2 = dom.createElement("td");
        var el3 = dom.createTextNode("\n            ");
        dom.appendChild(el2, el3);
        var el3 = dom.createElement("select");
        dom.setAttribute(el3,"class","form-control");
        var el4 = dom.createTextNode("\n              ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("option");
        dom.setAttribute(el4,"value","");
        var el5 = dom.createTextNode("Sem acesso");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n              ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("option");
        dom.setAttribute(el4,"value","readonly");
        var el5 = dom.createTextNode("Read Only");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n              ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("option");
        dom.setAttribute(el4,"value","restricted");
        var el5 = dom.createTextNode("Restricted");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n              ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("option");
        dom.setAttribute(el4,"value","member");
        var el5 = dom.createTextNode("Member");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n              ");
        dom.appendChild(el3, el4);
        var el4 = dom.createElement("option");
        dom.setAttribute(el4,"value","owner");
        var el5 = dom.createTextNode("Owner");
        dom.appendChild(el4, el5);
        dom.appendChild(el3, el4);
        var el4 = dom.createTextNode("\n            ");
        dom.appendChild(el3, el4);
        dom.appendChild(el2, el3);
        var el3 = dom.createTextNode("\n          ");
        dom.appendChild(el2, el3);
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var element1 = dom.childAt(fragment, [0]);
        var element2 = dom.childAt(element1, [1, 1]);
        var element3 = dom.childAt(element2, [1]);
        var element4 = dom.childAt(element2, [3]);
        var element5 = dom.childAt(element2, [5]);
        var element6 = dom.childAt(element2, [7]);
        var element7 = dom.childAt(element2, [9]);
        var morphs = new Array(8);
        morphs[0] = dom.createMorphAt(dom.childAt(element1, [0]),0,0);
        morphs[1] = dom.createAttrMorph(element2, 'aria-label');
        morphs[2] = dom.createAttrMorph(element2, 'onchange');
        morphs[3] = dom.createAttrMorph(element3, 'selected');
        morphs[4] = dom.createAttrMorph(element4, 'selected');
        morphs[5] = dom.createAttrMorph(element5, 'selected');
        morphs[6] = dom.createAttrMorph(element6, 'selected');
        morphs[7] = dom.createAttrMorph(element7, 'selected');
        return morphs;
      },
      statements: [
        ["content","environment.name",["loc",[null,[23,57],[23,77]]],0,0,0,0],
        ["attribute","aria-label",["concat",["Permissão em ",["get","environment.name",["loc",[null,[24,68],[24,84]]],0,0,0,0]],0,0,0,0,0],0,0,0,0],
        ["attribute","onchange",["subexpr","action",["setRole",["get","environment",["loc",[null,[24,116],[24,127]]],0,0,0,0]],["value","target.value"],["loc",[null,[null,null],[24,150]]],0,0],0,0,0,0],
        ["attribute","selected",["subexpr","eq",[["get","environment.role",["loc",[null,[25,45],[25,61]]],0,0,0,0],""],[],["loc",[null,[null,null],[25,66]]],0,0],0,0,0,0],
        ["attribute","selected",["subexpr","eq",[["get","environment.role",["loc",[null,[26,53],[26,69]]],0,0,0,0],"readonly"],[],["loc",[null,[null,null],[26,82]]],0,0],0,0,0,0],
        ["attribute","selected",["subexpr","eq",[["get","environment.role",["loc",[null,[27,55],[27,71]]],0,0,0,0],"restricted"],[],["loc",[null,[null,null],[27,86]]],0,0],0,0,0,0],
        ["attribute","selected",["subexpr","eq",[["get","environment.role",["loc",[null,[28,51],[28,67]]],0,0,0,0],"member"],[],["loc",[null,[null,null],[28,78]]],0,0],0,0,0,0],
        ["attribute","selected",["subexpr","eq",[["get","environment.role",["loc",[null,[29,50],[29,66]]],0,0,0,0],"owner"],[],["loc",[null,[null,null],[29,76]]],0,0],0,0,0,0]
      ],
      locals: ["environment"],
      templates: []
    };
  }());
  var child6 = (function() {
    return {
      meta: {
        "revision": "Ember@2.9.1",
        "loc": {
          "source": null,
          "start": {
            "line": 36,
            "column": 10
          },
          "end": {
            "line": 36,
            "column": 148
          }
        }
      },
      isEmpty: false,
      arity: 0,
      cachedFragment: null,
      hasRendered: false,
      buildFragment: function buildFragment(dom) {
        var el0 = dom.createDocumentFragment();
        var el1 = dom.createElement("button");
        dom.setAttribute(el1,"type","button");
        dom.setAttribute(el1,"class","btn btn-danger pull-right");
        var el2 = dom.createTextNode("Excluir grupo");
        dom.appendChild(el1, el2);
        dom.appendChild(el0, el1);
        return el0;
      },
      buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
        var element0 = dom.childAt(fragment, [0]);
        var morphs = new Array(2);
        morphs[0] = dom.createAttrMorph(element0, 'disabled');
        morphs[1] = dom.createElementMorph(element0);
        return morphs;
      },
      statements: [
        ["attribute","disabled",["get","saving",["loc",[null,[36,92],[36,98]]],0,0,0,0],0,0,0,0],
        ["element","action",["deleteGroup"],[],["loc",[null,[36,101],[36,125]]],0,0]
      ],
      locals: [],
      templates: []
    };
  }());
  return {
    meta: {
      "revision": "Ember@2.9.1",
      "loc": {
        "source": null,
        "start": {
          "line": 1,
          "column": 0
        },
        "end": {
          "line": 43,
          "column": 0
        }
      }
    },
    isEmpty: false,
    arity: 0,
    cachedFragment: null,
    hasRendered: false,
    buildFragment: function buildFragment(dom) {
      var el0 = dom.createDocumentFragment();
      var el1 = dom.createComment("");
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("\n");
      dom.appendChild(el0, el1);
      var el1 = dom.createElement("main");
      dom.setAttribute(el1,"class","clearfix");
      var el2 = dom.createTextNode("\n  ");
      dom.appendChild(el1, el2);
      var el2 = dom.createElement("section");
      dom.setAttribute(el2,"class","header clearfix");
      var el3 = dom.createElement("h1");
      var el4 = dom.createTextNode("Grupos e permissões");
      dom.appendChild(el3, el4);
      dom.appendChild(el2, el3);
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("\n  ");
      dom.appendChild(el1, el2);
      var el2 = dom.createElement("section");
      var el3 = dom.createTextNode("\n    ");
      dom.appendChild(el2, el3);
      var el3 = dom.createComment("");
      dom.appendChild(el2, el3);
      var el3 = dom.createTextNode("\n    ");
      dom.appendChild(el2, el3);
      var el3 = dom.createElement("div");
      dom.setAttribute(el3,"class","row");
      var el4 = dom.createTextNode("\n      ");
      dom.appendChild(el3, el4);
      var el4 = dom.createElement("div");
      dom.setAttribute(el4,"class","col span-3");
      var el5 = dom.createTextNode("\n        ");
      dom.appendChild(el4, el5);
      var el5 = dom.createElement("button");
      dom.setAttribute(el5,"type","button");
      dom.setAttribute(el5,"class","btn btn-primary r-mb20");
      var el6 = dom.createTextNode("Adicionar grupo");
      dom.appendChild(el5, el6);
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n        ");
      dom.appendChild(el4, el5);
      var el5 = dom.createElement("ul");
      dom.setAttribute(el5,"class","list-unstyled");
      var el6 = dom.createTextNode("\n          ");
      dom.appendChild(el5, el6);
      var el6 = dom.createComment("");
      dom.appendChild(el5, el6);
      var el6 = dom.createTextNode("\n        ");
      dom.appendChild(el5, el6);
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n      ");
      dom.appendChild(el4, el5);
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode("\n      ");
      dom.appendChild(el3, el4);
      var el4 = dom.createElement("div");
      dom.setAttribute(el4,"class","col span-9");
      var el5 = dom.createTextNode("\n        ");
      dom.appendChild(el4, el5);
      var el5 = dom.createElement("h2");
      var el6 = dom.createComment("");
      dom.appendChild(el5, el6);
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n        ");
      dom.appendChild(el4, el5);
      var el5 = dom.createElement("div");
      dom.setAttribute(el5,"class","row");
      var el6 = dom.createElement("div");
      dom.setAttribute(el6,"class","col span-12");
      var el7 = dom.createElement("label");
      dom.setAttribute(el7,"for","group-name");
      var el8 = dom.createTextNode("Nome do grupo*");
      dom.appendChild(el7, el8);
      dom.appendChild(el6, el7);
      var el7 = dom.createComment("");
      dom.appendChild(el6, el7);
      dom.appendChild(el5, el6);
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n        ");
      dom.appendChild(el4, el5);
      var el5 = dom.createElement("h3");
      dom.setAttribute(el5,"class","r-mt30");
      var el6 = dom.createTextNode("Usuários");
      dom.appendChild(el5, el6);
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n        ");
      dom.appendChild(el4, el5);
      var el5 = dom.createElement("p");
      dom.setAttribute(el5,"class","text-muted");
      var el6 = dom.createTextNode("Os usuários do Keycloak aparecem após o primeiro login. Os grupos são gerenciados aqui no Rancher.");
      dom.appendChild(el5, el6);
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n        ");
      dom.appendChild(el4, el5);
      var el5 = dom.createElement("div");
      dom.setAttribute(el5,"class","row");
      var el6 = dom.createElement("div");
      dom.setAttribute(el6,"class","col span-12");
      var el7 = dom.createTextNode("\n          ");
      dom.appendChild(el6, el7);
      var el7 = dom.createComment("");
      dom.appendChild(el6, el7);
      var el7 = dom.createTextNode("\n        ");
      dom.appendChild(el6, el7);
      dom.appendChild(el5, el6);
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n        ");
      dom.appendChild(el4, el5);
      var el5 = dom.createElement("h3");
      dom.setAttribute(el5,"class","r-mt30");
      var el6 = dom.createTextNode("Permissões por environment");
      dom.appendChild(el5, el6);
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n        ");
      dom.appendChild(el4, el5);
      var el5 = dom.createElement("table");
      dom.setAttribute(el5,"class","grid fixed");
      var el6 = dom.createElement("thead");
      var el7 = dom.createElement("tr");
      var el8 = dom.createElement("th");
      var el9 = dom.createTextNode("Environment");
      dom.appendChild(el8, el9);
      dom.appendChild(el7, el8);
      var el8 = dom.createElement("th");
      var el9 = dom.createTextNode("Papel");
      dom.appendChild(el8, el9);
      dom.appendChild(el7, el8);
      dom.appendChild(el6, el7);
      dom.appendChild(el5, el6);
      var el6 = dom.createElement("tbody");
      var el7 = dom.createTextNode("\n          ");
      dom.appendChild(el6, el7);
      var el7 = dom.createComment("");
      dom.appendChild(el6, el7);
      var el7 = dom.createTextNode("\n        ");
      dom.appendChild(el6, el7);
      dom.appendChild(el5, el6);
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n        ");
      dom.appendChild(el4, el5);
      var el5 = dom.createElement("div");
      dom.setAttribute(el5,"class","footer-actions r-mt30");
      var el6 = dom.createTextNode("\n          ");
      dom.appendChild(el5, el6);
      var el6 = dom.createElement("button");
      dom.setAttribute(el6,"type","button");
      dom.setAttribute(el6,"class","btn btn-primary");
      var el7 = dom.createComment("");
      dom.appendChild(el6, el7);
      dom.appendChild(el5, el6);
      var el6 = dom.createTextNode("\n          ");
      dom.appendChild(el5, el6);
      var el6 = dom.createElement("button");
      dom.setAttribute(el6,"type","button");
      dom.setAttribute(el6,"class","btn btn-link");
      var el7 = dom.createTextNode("Cancelar");
      dom.appendChild(el6, el7);
      dom.appendChild(el5, el6);
      var el6 = dom.createTextNode("\n          ");
      dom.appendChild(el5, el6);
      var el6 = dom.createComment("");
      dom.appendChild(el5, el6);
      var el6 = dom.createTextNode("\n        ");
      dom.appendChild(el5, el6);
      dom.appendChild(el4, el5);
      var el5 = dom.createTextNode("\n      ");
      dom.appendChild(el4, el5);
      dom.appendChild(el3, el4);
      var el4 = dom.createTextNode("\n    ");
      dom.appendChild(el3, el4);
      dom.appendChild(el2, el3);
      var el3 = dom.createTextNode("\n  ");
      dom.appendChild(el2, el3);
      dom.appendChild(el1, el2);
      var el2 = dom.createTextNode("\n");
      dom.appendChild(el1, el2);
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("\n");
      dom.appendChild(el0, el1);
      var el1 = dom.createComment("");
      dom.appendChild(el0, el1);
      var el1 = dom.createTextNode("\n");
      dom.appendChild(el0, el1);
      return el0;
    },
    buildRenderNodes: function buildRenderNodes(dom, fragment, contextualElement) {
      var element11 = dom.childAt(fragment, [2, 3]);
      var element12 = dom.childAt(element11, [3]);
      var element13 = dom.childAt(element12, [1]);
      var element14 = dom.childAt(element13, [1]);
      var element15 = dom.childAt(element12, [3]);
      var element16 = dom.childAt(element15, [15]);
      var element17 = dom.childAt(element16, [1]);
      var element18 = dom.childAt(element16, [3]);
      var morphs = new Array(14);
      morphs[0] = dom.createMorphAt(fragment,0,0,contextualElement);
      morphs[1] = dom.createMorphAt(element11,1,1);
      morphs[2] = dom.createElementMorph(element14);
      morphs[3] = dom.createMorphAt(dom.childAt(element13, [3]),1,1);
      morphs[4] = dom.createMorphAt(dom.childAt(element15, [1]),0,0);
      morphs[5] = dom.createMorphAt(dom.childAt(element15, [3, 0]),1,1);
      morphs[6] = dom.createMorphAt(dom.childAt(element15, [9, 0]),1,1);
      morphs[7] = dom.createMorphAt(dom.childAt(element15, [13, 1]),1,1);
      morphs[8] = dom.createAttrMorph(element17, 'disabled');
      morphs[9] = dom.createElementMorph(element17);
      morphs[10] = dom.createMorphAt(element17,0,0);
      morphs[11] = dom.createElementMorph(element18);
      morphs[12] = dom.createMorphAt(element16,5,5);
      morphs[13] = dom.createMorphAt(fragment,4,4,contextualElement);
      dom.insertBoundary(fragment, 0);
      return morphs;
    },
    statements: [
      ["inline","page-header",[],["currentPath","local-groups"],["loc",[null,[1,0],[1,42]]],0,0],
      ["block","if",[["get","message",["loc",[null,[5,10],[5,17]]],0,0,0,0]],[],0,null,["loc",[null,[5,4],[5,214]]]],
      ["element","action",["newGroup"],[],["loc",[null,[8,61],[8,82]]],0,0],
      ["block","each",[["get","model.groups",["loc",[null,[10,18],[10,30]]],0,0,0,0]],[],1,2,["loc",[null,[10,10],[10,231]]]],
      ["inline","if",[["get","current",["loc",[null,[14,17],[14,24]]],0,0,0,0],"Editar grupo","Adicionar grupo"],[],["loc",[null,[14,12],[14,59]]],0,0],
      ["inline","input",[],["id","group-name","class","form-control","value",["subexpr","@mut",[["get","draftName",["loc",[null,[15,147],[15,156]]],0,0,0,0]],[],[],0,0],"placeholder","Ex.: Suporte","maxlength","128"],["loc",[null,[15,96],[15,201]]],0,0],
      ["block","each",[["get","members",["loc",[null,[19,18],[19,25]]],0,0,0,0]],[],3,4,["loc",[null,[19,10],[19,271]]]],
      ["block","each",[["get","environments",["loc",[null,[23,18],[23,30]]],0,0,0,0]],[],5,null,["loc",[null,[23,10],[31,29]]]],
      ["attribute","disabled",["get","saving",["loc",[null,[34,67],[34,73]]],0,0,0,0],0,0,0,0],
      ["element","action",["saveGroup"],[],["loc",[null,[34,76],[34,98]]],0,0],
      ["inline","if",[["get","saving",["loc",[null,[34,104],[34,110]]],0,0,0,0],"Salvando...","Salvar"],[],["loc",[null,[34,99],[34,135]]],0,0],
      ["element","action",["newGroup"],[],["loc",[null,[35,53],[35,74]]],0,0],
      ["block","if",[["get","current",["loc",[null,[36,16],[36,23]]],0,0,0,0]],[],6,null,["loc",[null,[36,10],[36,155]]]],
      ["content","page-footer",["loc",[null,[42,0],[42,15]]],0,0,0,0]
    ],
    locals: [],
    templates: [child0, child1, child2, child3, child4, child5, child6]
  };
}())};