import { Component, director, Director, geometry, Mask, Node, UITransform, _decorator } from "cc";
const { ccclass, property } = _decorator;

@ccclass("BatchItems")
export class BatchItems extends Component {
    //全局合批队列记录

    static nodes: Array<Node> = [];
    static queues: Array<Queue> = [];

    queue: Queue = new Queue(); //优先级分层队列
    children: Array<Node> = []; //记录原节点结构

    @property(UITransform)
    culling: UITransform | null = null;

    update(dt: number) {
        BatchItems.nodes.push(this.node);
        BatchItems.queues.push(this.queue);
    }
}

//绘画层
class Draw {
    key: string = ""; //以节点名为标记
    mask: boolean = false; //是否有mask遮盖组件
    nodes: Array<Node> = []; //绘画节点容器
    localOpacitys: Array<number> = [];
    childrens: Array<Array<Node>> = []; //绘图节点原子节点数据

    next: Draw | null = null;
    prev: Draw | null = null;

    constructor(key: string) {
        this.key = key;
        this.mask = false;
        this.nodes = [];
        this.childrens = [];
    }
}

//绘画层队列
class Queue {
    items: any = {};
    head: Draw | null = null;

    constructor() {
        this.items = {};
        this.head = null;
    }

    get(key: string) {
        return this.items[key];
    }

    set(prev: Draw | null, data: Draw) {
        this.items[data.key] = data;
        if (!this.head) this.head = data;
        else {
            data.next = prev!.next;
            prev!.next = data;
            data.prev = prev;
        }
    }

    clear() {
        Object.keys(this.items).forEach((key) => {
            delete this.items[key];
        });
        this.head = null;
        this.items = {};
    }
}

//遍历建立绘图层队，并收集绘画节点, 全程以节点名字来作为唯一识别标记
const DFS = function (prev: Draw | null, node: Node, queue: Queue, active: boolean, level: number = 0, opacity: number = 1.0) {
    const uiProps = node._uiProps;
    const render: any = uiProps.uiComp; // as Renderable2D;
    opacity = opacity * uiProps.localOpacity;

    //注意：根据节点的名字进行分层，务必确保名字的唯一性
    let key = node.name; //添加层级前缀加强同名过滤
    if (level == 0) key = "98K"; //自定义收集首节点(允许Item首节点异名)
    let draw = queue.get(key);
    if (!draw) {
        draw = new Draw(key);
        queue.set(prev, draw);

        //检测是否带有mask组件，不建议item内有mask
        if (render)
            //mask 会打断合批，会增加draw call
            draw.mask = node.getComponent(Mask) != null;
    }

    prev = draw;

    if (render) {
        let nodes = draw.nodes;
        let localOpacitys = draw.localOpacitys;

        let selfOpacity = render.color ? render.color.a / 255 : 1;
        // let currOpactity = opacity * selfOpacity * uiProps.localOpacity;
        if (active) {
            //node.active && active
            nodes.push(node); //收集节点
            localOpacitys.push(uiProps.localOpacity); //保存透明度
            uiProps.localOpacity = opacity; //opacity * uiProps.localOpacity; //设置当前透明度
        }
        //opacity = currOpactity;

        opacity = opacity * selfOpacity;
    }

    if (draw.mask) return prev;

    let childs = node.children;
    for (let i = 0; i < childs.length; i++) {
        let isActive = childs[i].active ? active : false;
        prev = DFS(prev, childs[i], queue, isActive, level + 1, opacity);
    }

    return prev;
};

const changeTree = function (parent: Node, queue: Queue) {
    // queue.clear();

    let aabb0 = new geometry.AABB();
    let aabb1 = new geometry.AABB();
    let btn = parent.getComponent(BatchItems)!;
    btn.culling && btn.culling.getComputeAABB(aabb0);

    //遍历所有绘画节点，按顺序分层
    let nodes = parent.children;
    for (let i = 0; i < nodes.length; i++) {
        let node = nodes[i];
        if (node.activeInHierarchy) {
            //剔除显示范围外的item
            if (btn.culling) {
                let uiProps = node._uiProps;
                let trans = uiProps.uiTransformComp;
                if (trans) {
                    trans.getComputeAABB(aabb1);
                    if (!geometry.intersect.aabbWithAABB(aabb0, aabb1)) continue;
                }
            }

            DFS(null, node, queue, true);
        }
    }

    // //记录item的父节点的子节点结构
    // let btn = parent.getComponent(BatchItems)!;
    btn.children = parent["_children"]; //记录原来节点结构
    let childs: Array<Node> = (parent["_children"] = []); //创建动态分层节点结构

    //拼接动态分层的绘画节点
    let curr = queue.head;
    while (curr) {
        let mask = curr.mask;
        let nodes = curr.nodes;
        let childrens = curr.childrens;
        for (let i = 0; i < nodes.length; i++) {
            childrens[i] = nodes[i]["_children"]; //记录原来节点结构
            !mask && (nodes[i]["_children"] = []); //清空切断下层节点
        }

        //按顺序拼接分层节点
        childs.push(...nodes);
        curr = curr.next;
    }
};

const resetTree = function (parent: Node, queue: Queue) {
    //恢复父节点结构
    let btn = parent.getComponent(BatchItems)!;
    parent["_children"].length = 0; //清空动态分层节点结构
    parent["_children"] = btn.children; //恢复原来节点结构

    //恢复原来节点结构
    let curr = queue.head;
    while (curr) {
        let nodes = curr.nodes;
        let childrens = curr.childrens;
        let localOpacitys = curr.localOpacitys;
        for (let i = 0; i < nodes.length; i++) {
            nodes[i]["_children"] = childrens[i]; //恢复原来节点结构

            //恢复原来透明度
            let uiProps = nodes[i]._uiProps;
            uiProps.localOpacity = localOpacitys[i];
            // childrens[i] = [];
        }
        childrens.length = 0;
        nodes.length = 0;
        curr = curr.next;
    }

    queue.clear();
};

director.on(Director.EVENT_BEFORE_DRAW, (dt) => {
    //绘画前拦截修改节点结构
    let nodes = BatchItems.nodes;
    let queues = BatchItems.queues;
    for (let i = 0; i < nodes.length; i++) {
        let node = nodes[i];
        if (node.active && node.isValid) {
            changeTree(node, queues[i]);
        }
    }
});

director.on(Director.EVENT_AFTER_DRAW, (dt) => {
    //绘画结束后恢复节点结构
    let nodes = BatchItems.nodes;
    let queues = BatchItems.queues;
    for (let i = 0; i < nodes.length; i++) {
        let node = nodes[i];
        if (node && node.isValid) {
            resetTree(node, queues[i]);
        }
    }

    nodes.length = 0;
    queues.length = 0;
});
