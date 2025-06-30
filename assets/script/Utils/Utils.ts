import { Component, easing, ERaycast2DType, Node, PhysicsSystem2D, Quat, RaycastResult2D, Sprite, SpriteFrame, tween, UITransform, v2, v3, Vec2, Vec3 } from "cc";
export class Utils {
    // 区域检测
    static crashCheck(nodeList: Node[], targetPos: Vec3, safeArea: number = 0) {
        // 获取点的坐标
        for (let index = 0; index < nodeList.length; index++) {
            const element = nodeList[index];
            if (this.nodeAreaCheck(element, targetPos, safeArea)) return true;
        }
        return false;
    }

    /** 节点区域检测 */
    static nodeAreaCheck(element: Node, targetPos: Vec3, safeArea: number = 0) {
        const worldPos = element.worldPosition;
        const width = element.getComponent(UITransform)!.width;
        const height = element.getComponent(UITransform)!.height;
        const leftX = worldPos.x - width / 2 - safeArea;
        const rightX = worldPos.x + width / 2 + safeArea;
        const topY = worldPos.y + height / 2 + safeArea;
        const bottomY = worldPos.y - height / 2 - safeArea;
        if (targetPos.x > leftX && targetPos.x < rightX && targetPos.y > bottomY && targetPos.y < topY) return true;
        return false;
    }

    /**
     * 把秒转换为时分秒
     * @param time 秒
     * @returns
     */
    static transformTime(time: number) {
        let m: number | string = Math.floor(time / 60);
        let h: number | string = Math.floor(m / 60);
        let s: number | string = time % 60;
        if (m < 10) {
            m = "0" + m.toString();
        }
        if (h < 10) {
            h = "0" + h.toString();
        }
        if (s < 10) {
            s = "0" + s.toString();
        }
        return { h, m, s };
    }

    /**
     * 把毫秒转换为时分秒
     * @param ms 毫秒
     * @returns
     */
    static transformMs(ms: number) {
        let time: number | string = Math.floor(ms / 1000); // 总共多少秒
        let m: number | string = Math.floor(time / 60);
        let h: number | string = Math.floor(m / 60);
        let s: number | string = time % 60;
        if (m < 10) {
            m = "0" + m.toString();
        }
        if (h < 10) {
            h = "0" + h.toString();
        }
        if (s < 10) {
            s = "0" + s.toString();
        }
        return { h, m, s };
    }

    /**
     * 计算反射向量
     * @param normal 法线
     * @param enter 入射角
     * @returns 反射角度
     */
    static calculateReflection(normal: Vec2, enter: Vec2) {
        const dotProduct = Vec2.dot(enter, normal);
        const reflection = enter.subtract(normal.multiplyScalar(2 * dotProduct));
        return reflection;
    }

    /**
     * 角度转弧度
     * @param angle
     * @returns
     */
    static AngleToRadian(angle: number) {
        return (angle / 180) * Math.PI;
    }

    /**
     * 弧度转角度
     * @param radian
     * @returns
     */
    static RadianToAngle(radian: number) {
        return (radian / Math.PI) * 180;
    }

    /**
     * 根据圆心世界坐标 R半径 偏转角度 获取圆上一个坐标
     * @param circle 圆心坐标
     * @param R 半径
     * @param angle 偏转角度 0度是X轴正方向
     * @returns 世界坐标
     */
    static getWorldPosByR(circle: Vec3, R: number, angle: number): Vec3 {
        let radian = this.AngleToRadian(angle);
        // 计算圆上的点的坐标
        let x = circle.x + R * Math.cos(radian);
        let y = circle.y + R * Math.sin(radian);
        let z = circle.z;

        // 返回世界坐标
        return v3(x, y, z);
    }

    /**
     * 根据起点终点计算方向向量
     * @param startPos
     * @param endPos
     * @returns
     */
    static getDirByStartPosEndPos(startPos: Vec3, endPos: Vec3): Vec2 {
        let dx = endPos.x - startPos.x;
        let dy = endPos.y - startPos.y;
        return v2(dx, dy).normalize();
    }

    /**
     * 构造一条射线并返回检测结果
     * @param checkDir 检测方向
     * @param rayLength 射线长度
     * @param rayStartPos 射线起点
     * @returns
     */
    static rayCheck(checkDir: Vec2, rayLength: number, rayStartPos: Vec3, checkType?: ERaycast2DType): readonly Readonly<RaycastResult2D>[] {
        let rayS = rayStartPos;
        let temp = checkDir.normalize();
        let rayE = v3(rayS.x + temp.x * rayLength, rayS.y + temp.y * rayLength);
        return PhysicsSystem2D.instance.raycast(rayS, rayE, checkType);
    }

    /**
     * 返回切线方向向量
     * @param circleCenter 圆心
     * @param pointOnCircle 在圆上的点坐标
     * @returns
     */
    static calculateTangent(circleCenter: Vec3, pointOnCircle: Vec3, isClockwise: boolean = false) {
        const cp = new Vec2(pointOnCircle.x - circleCenter.x, pointOnCircle.y - circleCenter.y);
        // 统一方向计算逻辑（无需象限判断）
        const tangent = isClockwise ? new Vec2(cp.y, -cp.x) : new Vec2(-cp.y, cp.x);
        return tangent.normalize(); // 归一化向量
    }

    /**
     * 判断向量在车的左边还是右边
     * @param front 前方
     * @param rotation 待检测向量
     * @returns
     */
    static isLeftOrRight(front: Vec2, rotation: Vec2) {
        const cross = front.x * rotation.y - front.y * rotation.x;
        return cross < 0 ? -1 : 1;
    }

    /**
     * 获取射线上距离起点一定距离的点坐标
     * @param checkDir 检测方向
     * @param rayLength 射线长度
     * @param rayStartPos 射线起点
     * @returns
     */
    static getPosByDir(checkDir: Vec2, rayLength: number, rayStartPos: Vec3): Vec3 {
        let rayS = rayStartPos;
        let temp = checkDir.normalize();
        let rayE = v3(rayS.x + temp.x * rayLength, rayS.y + temp.y * rayLength);
        return rayE;
    }

    /**
     * 获取节点的四个角的世界坐标
     * @param dir 节点的欧拉角
     * @param center 节点的中心点世界坐标 锚点是(0.5,0.5)
     * @param width 节点的宽度
     * @param height 节点的高度
     */
    static getAABB(euler: number, center: Vec3, width: number, height: number) {
        // 定义四个角的局部坐标
        const cornersLocal = [
            new Vec3(-width / 2, height / 2, 0), // 左上角
            new Vec3(width / 2, height / 2, 0), // 右上角
            new Vec3(-width / 2, -height / 2, 0), // 左下角
            new Vec3(width / 2, -height / 2, 0), // 右下角
        ];
        // 旋转矩阵（绕 z 轴）
        const rotationMatrix = new Quat();
        Quat.fromEuler(rotationMatrix, 0, 0, euler);
        // 计算旋转后的世界坐标
        const cornersWorld = cornersLocal.map((corner) => {
            const rotatedCorner = new Vec3();
            Vec3.transformQuat(rotatedCorner, corner, rotationMatrix); // 应用旋转
            rotatedCorner.add(center); // 转换为世界坐标
            return rotatedCorner;
        });
        return cornersWorld;
    }

    /**
     * 根据起点和终点, 以起终点连接线为中轴线 获取矩形的四个角的坐标
     */
    static getRectLLRR(startPos: Vec3, endPos: Vec3, width: number) {
        let height = Vec3.distance(startPos, endPos);
        let normal = this.getDirByStartPosEndPos(startPos, endPos);
        let midPos = v3((startPos.x + endPos.x) / 2, (startPos.y + endPos.y) / 2);
        let leftT = v3(midPos.x - (width / 2) * normal.y - (height / 2) * normal.x, midPos.y + (width / 2) * normal.x - (height / 2) * normal.y);
        let rightT = v3(midPos.x + (width / 2) * normal.y - (height / 2) * normal.x, midPos.y - (width / 2) * normal.x - (height / 2) * normal.y);
        let leftB = v3(midPos.x - (width / 2) * normal.y + (height / 2) * normal.x, midPos.y + (width / 2) * normal.x + (height / 2) * normal.y);
        let rightB = v3(midPos.x + (width / 2) * normal.y + (height / 2) * normal.x, midPos.y - (width / 2) * normal.x + (height / 2) * normal.y);
        return { leftT, rightT, leftB, rightB };
    }

    /** 递归设置灰度 */
    static setGratLoop(node: Node, isGray: boolean) {
        if (node.isValid) {
            let sprite = node.getComponent(Sprite);
            if (sprite) {
                sprite.grayscale = isGray;
            }
            node.children.forEach((child) => {
                this.setGratLoop(child, isGray);
            });
        }
    }

    /**
     * 睡眠函数
     * @param time 睡眠时长 单位秒
     */
    static sleep(time: number, context: Component): Promise<void> {
        return new Promise((resolve, reject) => {
            context.scheduleOnce(() => {
                resolve();
            }, time);
        });
    }

    /** 洗牌算法 */
    static shuffle(arr: number[]) {
        const arrcopy = [...arr];
        for (let i = arrcopy.length - 1; i > 0; i--) {
            const j = this.getRandomIntInclusive(0, i);
            [arrcopy[i], arrcopy[j]] = [arrcopy[j], arrcopy[i]];
        }
        return arrcopy;
    }

    /**
     * describe: 在范围内获取随机整数值 [min, max]
     * @param min : 最小值
     * @param max : 最大值
     */
    static getRandomIntInclusive(min: number, max: number): number {
        min = Math.ceil(min);
        max = Math.floor(max);
        return Math.floor(Math.random() * (max - min + 1)) + min; //The maximum is inclusive and the minimum is inclusive
    }
}
