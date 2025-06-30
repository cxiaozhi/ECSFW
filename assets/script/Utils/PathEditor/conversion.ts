import { BezierPath } from "./BezierPath";
import { BezierSegment } from "./BezierSegment";
import { BezierControlPoint, DrawingCommand } from "../types";
import { Vec2 } from "cc";

const PATH_COMMANDS: any = {
    M: ["x", "y"],
    m: ["dx", "dy"],
    H: ["x"],
    h: ["dx"],
    V: ["y"],
    v: ["dy"],
    L: ["x", "y"],
    l: ["dx", "dy"],
    Z: [],
    C: ["x1", "y1", "x2", "y2", "x", "y"],
    c: ["dx1", "dy1", "dx2", "dy2", "dx", "dy"],
    S: ["x2", "y2", "x", "y"],
    s: ["dx2", "dy2", "dx", "dy"],
    Q: ["x1", "y1", "x", "y"],
    q: ["dx1", "dy1", "dx", "dy"],
    T: ["x", "y"],
    t: ["dx", "dy"],
    A: ["rx", "ry", "rotation", "large-arc", "sweep", "x", "y"],
    a: ["rx", "ry", "rotation", "large-arc", "sweep", "dx", "dy"],
};

function fromPathToArray(path: string): DrawingCommand[] {
    const items = path
        .replace(/[\n\r]/g, "")
        .replace(/-/g, " -")
        .replace(/(\d*\.)(\d+)(?=\.)/g, "$1$2 ")
        .replace(/(\d)([A-Za-z])/g, "$1 $2")
        .replace(/([A-Za-z])(\d)/g, "$1 $2")
        .trim()
        .split(/\s*,|\s+/);
    const segments: DrawingCommand[] = [];
    let currentCommand: string = "";
    let currentElement: any = {};
    while (items.length > 0) {
        let it = items.shift()!;
        if (PATH_COMMANDS.hasOwnProperty(it)) {
            currentCommand = it;
        } else {
            items.unshift(it);
        }
        currentElement = { type: currentCommand };
        PATH_COMMANDS[currentCommand].forEach((prop: any) => {
            it = items.shift()!; // TODO sanity check
            currentElement[prop] = parseFloat(it);
        });
        if (currentCommand === "M") {
            currentCommand = "L";
        } else if (currentCommand === "m") {
            currentCommand = "l";
        }
        segments.push(currentElement as any);
    }
    return segments;
}

export const createFromPath = (el: SVGPathElement) => {
    const commands = fromPathToArray(el.getAttribute("d")!);
    if (commands.length < 2) {
        throw new Error(`Path doesn't have enough commands: ${JSON.stringify(commands)}`);
    }
    if (commands[0].type !== "M") {
        throw new Error(`Path starts with ${commands[0].type} instead of M!`);
    }
    let lastPoint = { x: commands[0].x, y: commands[0].y };
    commands.shift();
    const segments: BezierSegment[] = [];
    while (commands.length > 0) {
        const command = commands.shift()!;
        if (command.type === "C") {
            segments.push(new BezierSegment(lastPoint, { x: command.x1, y: command.y1 }, { x: command.x2, y: command.y2 }, { x: command.x, y: command.y }));
            lastPoint = { x: command.x, y: command.y };
        } else if (command.type === "L") {
            segments.push(new BezierSegment(lastPoint, lastPoint, { x: command.x, y: command.y }, { x: command.x, y: command.y }));
            lastPoint = { x: command.x, y: command.y };
        } else if (command.type === "H") {
            segments.push(new BezierSegment(lastPoint, lastPoint, { x: command.x, y: lastPoint.y }, { x: command.x, y: lastPoint.y }));
            lastPoint = { x: command.x, y: lastPoint.y };
        } else if (command.type === "V") {
            segments.push(new BezierSegment(lastPoint, lastPoint, { x: lastPoint.x, y: command.y }, { x: lastPoint.x, y: command.y }));
            lastPoint = { x: lastPoint.x, y: command.y };
        } else if (command.type === "Z") {
            // noop
        } else {
            throw new Error(`Unsupported path command ${command.type}; use only H, V, M, L, C, Z!`);
        }
    }
    return new BezierPath(segments);
};

export const createFromLine = (el: SVGLineElement) => {
    const [x1, x2, y1, y2] = ["x1", "x2", "y1", "y2"].map((prop) => parseFloat(el.getAttribute(prop) || "0"));

    return new BezierPath([new BezierSegment({ x: x1, y: y1 }, { x: x1, y: y1 }, { x: x2, y: y2 }, { x: x2, y: y2 })]);
};

export const createFromCircle = (el: SVGCircleElement) => {
    const [cx, cy, r] = ["cx", "cy", "r"].map((prop) => parseFloat(el.getAttribute(prop) || "0"));

    const k = 1.3;
    return new BezierPath([
        new BezierSegment({ x: cx - r, y: cy }, { x: cx - r, y: cy - k * r }, { x: cx + r, y: cy - k * r }, { x: cx + r, y: cy }),
        new BezierSegment({ x: cx + r, y: cy }, { x: cx + r, y: cy + k * r }, { x: cx - r, y: cy + k * r }, { x: cx - r, y: cy }),
    ]);
};

export const createFromElement = (el: SVGElement) => {
    const tag = el.tagName.toLowerCase();
    if (tag === "path") {
        return createFromPath(el as SVGPathElement);
    } else if (tag === "line") {
        return createFromLine(el as SVGLineElement);
    } else if (tag === "circle") {
        return createFromCircle(el as SVGCircleElement);
    } else {
        throw new Error(`Unsupported SVG tag: ${tag}`);
    }
};

interface Vec2Like {
    x: number;
    y: number;
}

/** 计算两点之间的距离 */
function distance(p1: Vec2Like, p2: Vec2Like): number {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.sqrt(dx * dx + dy * dy);
}

/** 计算贝塞尔曲线上的点 */
function getBezierPoint(t: number, p0: Vec2Like, p1: Vec2Like, p2: Vec2Like, p3: Vec2Like): Vec2Like {
    const oneMinusT = 1 - t;
    const oneMinusT2 = oneMinusT * oneMinusT;
    const oneMinusT3 = oneMinusT2 * oneMinusT;
    const t2 = t * t;
    const t3 = t2 * t;

    return {
        x: oneMinusT3 * p0.x + 3 * oneMinusT2 * t * p1.x + 3 * oneMinusT * t2 * p2.x + t3 * p3.x,
        y: oneMinusT3 * p0.y + 3 * oneMinusT2 * t * p1.y + 3 * oneMinusT * t2 * p2.y + t3 * p3.y,
    };
}

/** 计算贝塞尔曲线的长度 */
function getBezierLength(p0: Vec2Like, p1: Vec2Like, p2: Vec2Like, p3: Vec2Like, steps: number = 100): number {
    let length = 0;
    let lastPoint = p0;

    for (let i = 1; i <= steps; i++) {
        const t = i / steps;
        const point = getBezierPoint(t, p0, p1, p2, p3);
        length += distance(lastPoint, point);
        lastPoint = point;
    }

    return length;
}

/** 均匀采样贝塞尔曲线 */
function sampleBezierCurve(p0: Vec2Like, p1: Vec2Like, p2: Vec2Like, p3: Vec2Like, pixelDistance: number = 1): Vec2Like[] {
    // 计算曲线总长度
    const totalLength = getBezierLength(p0, p1, p2, p3);
    const numPoints = Math.ceil(totalLength / pixelDistance);

    const points: Vec2Like[] = [p0];

    // 根据曲线长度均匀采样
    for (let i = 1; i < numPoints; i++) {
        const t = i / numPoints;
        points.push(getBezierPoint(t, p0, p1, p2, p3));
    }

    // 确保包含终点
    if (distance(points[points.length - 1], p3) > 0.1) {
        points.push(p3);
    }

    // 调整点之间的距离为1像素
    const result: Vec2Like[] = [points[0]];
    let currentPoint = points[0];

    for (let i = 1; i < points.length; i++) {
        const nextPoint = points[i];
        const dist = distance(currentPoint, nextPoint);

        if (dist > 0) {
            // 如果距离大于1，插入中间点
            const numSteps = Math.ceil(dist);
            for (let j = 1; j < numSteps; j++) {
                const t = j / numSteps;
                result.push({
                    x: currentPoint.x + (nextPoint.x - currentPoint.x) * t,
                    y: currentPoint.y + (nextPoint.y - currentPoint.y) * t,
                });
            }
        }

        result.push(nextPoint);
        currentPoint = nextPoint;
    }

    return result;
}

export const create = (points: BezierControlPoint[]) => {
    if (points.length < 2) return new BezierPath([]);

    const segments: BezierSegment[] = [];
    const sampledPoints: Vec2Like[] = [];

    // 处理每个贝塞尔段
    for (let i = 1; i < points.length; i++) {
        const prev = points[i - 1];
        const curr = points[i];

        // 采样当前段
        const segmentPoints = sampleBezierCurve(prev.pt, prev.right || prev.pt, curr.left || curr.pt, curr.pt);

        // 将采样点添加到结果中
        if (i === 1) {
            sampledPoints.push(...segmentPoints);
        } else {
            // 跳过第一个点，避免重复
            sampledPoints.push(...segmentPoints.slice(1));
        }
    }

    // 创建新的贝塞尔段，每个段连接两个相邻的采样点
    for (let i = 0; i < sampledPoints.length - 1; i++) {
        segments.push(new BezierSegment(sampledPoints[i], sampledPoints[i], sampledPoints[i + 1], sampledPoints[i + 1]));
    }

    return new BezierPath(segments);
};

export const createFromCommands = (rawCommands: DrawingCommand[]) => {
    const commands = rawCommands.slice();
    if (commands.length < 2) {
        throw new Error(`Path doesn't have enough commands: ${JSON.stringify(commands)}`);
    }
    if (commands[0].type !== "M") {
        throw new Error(`Path starts with ${commands[0].type} instead of M!`);
    }
    let lastPoint = { x: commands[0].x, y: commands[0].y };
    let firstPoint = { ...lastPoint };
    const segments: BezierSegment[] = [];
    while (commands.length > 0) {
        const command = commands.shift()!;
        if (command.type === "M") {
            firstPoint = {
                x: command.x,
                y: command.y,
            };
            lastPoint = firstPoint;
        } else if (command.type === "C") {
            segments.push(new BezierSegment(lastPoint, { x: command.x1, y: command.y1 }, { x: command.x2, y: command.y2 }, { x: command.x, y: command.y }));
            lastPoint = { x: command.x, y: command.y };
        } else if (command.type === "L") {
            if (command.x !== lastPoint.x || command.y !== lastPoint.y) {
                segments.push(new BezierSegment(lastPoint, lastPoint, { x: command.x, y: command.y }, { x: command.x, y: command.y }));
            }
            lastPoint = { x: command.x, y: command.y };
        } else if (command.type === "H") {
            if (command.x !== lastPoint.x) {
                segments.push(new BezierSegment(lastPoint, lastPoint, { x: command.x, y: lastPoint.y }, { x: command.x, y: lastPoint.y }));
            }
            lastPoint = { x: command.x, y: lastPoint.y };
        } else if (command.type === "V") {
            if (command.y !== lastPoint.y) {
                segments.push(new BezierSegment(lastPoint, lastPoint, { x: lastPoint.x, y: command.y }, { x: lastPoint.x, y: command.y }));
            }
            lastPoint = { x: lastPoint.x, y: command.y };
        } else if (command.type === "Q") {
            segments.push(
                new BezierSegment(
                    lastPoint,
                    {
                        x: lastPoint.x + (2 / 3) * (command.x1 - lastPoint.x),
                        y: lastPoint.y + (2 / 3) * (command.y1 - lastPoint.y),
                    },
                    {
                        x: command.x + (2 / 3) * (command.x1 - command.x),
                        y: command.y + (2 / 3) * (command.y1 - command.y),
                    },
                    { x: command.x, y: command.y }
                )
            );
            lastPoint = { x: command.x, y: command.y };
        } else if (command.type === "Z") {
            if (Math.hypot(lastPoint.x - firstPoint.x, lastPoint.y - firstPoint.y) > 0) {
                segments.push(new BezierSegment(lastPoint, lastPoint, firstPoint, firstPoint));
            }
        } else {
            throw new Error(
                // @ts-ignore
                `Unsupported path command ${command.type}; use only H, V, M, L, C, Z!`
            );
        }
    }
    return new BezierPath(segments);
};
