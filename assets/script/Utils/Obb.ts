import { Vec3 } from "cc";

/**
 * OBB碰撞检测
 * 检测两个带旋转角度的矩形是否相交
 * @example const OBB1 = new Obb(this.box1.node.worldPosition.clone(), this.box1.width, this.box1.height, this.box1.node.angle * Math.PI / 180);
  const OBB2 = new Obb(this.box2.node.worldPosition.clone(), this.box2.width, this.box2.height, this.box2.node.angle * Math.PI / 180);
    let r = Obb.detectorObb(OBB1, OBB2);
    console.log(`-----> 是否相交:${r}`);
 */
export class Obb {
    worldPosition: Vec3;

    extents: number[];

    axes: Vec3[];

    constructor(worldPosition: Vec3, width: number, height: number, rotation: number) {
        this.worldPosition = worldPosition;

        this.extents = [width / 2, height / 2];

        this.axes = [new Vec3(Math.cos(rotation), Math.sin(rotation)), new Vec3(-1 * Math.sin(rotation), Math.cos(rotation))];
    }

    /** 更新属性 */
    refreshProperty(worldPosition: Vec3, width: number, height: number, rotation: number) {
        this.worldPosition = worldPosition;

        this.extents = [width / 2, height / 2];

        this.axes = [new Vec3(Math.cos(rotation), Math.sin(rotation)), new Vec3(-1 * Math.sin(rotation), Math.cos(rotation))];
    }

    /**
     * 检测两个矩形是否相交
     * @param obb1 矩形1
     * @param obb2 矩形2
     * @returns
     */
    static detectorObb(obb1: Obb, obb2: Obb): boolean {
        let nv = obb1.worldPosition.subtract(obb2.worldPosition);

        let axisA1 = obb1.axes[0];

        if (obb1.getProjectionRadius(axisA1) + obb2.getProjectionRadius(axisA1) <= Math.abs(nv.dot(axisA1))) return false;

        let axisA2 = obb1.axes[1];

        if (obb1.getProjectionRadius(axisA2) + obb2.getProjectionRadius(axisA2) <= Math.abs(nv.dot(axisA2))) return false;

        let axisB1 = obb2.axes[0];

        if (obb1.getProjectionRadius(axisB1) + obb2.getProjectionRadius(axisB1) <= Math.abs(nv.dot(axisB1))) return false;

        let axisB2 = obb2.axes[1];

        if (obb1.getProjectionRadius(axisB2) + obb2.getProjectionRadius(axisB2) <= Math.abs(nv.dot(axisB2))) return false;

        return true;
    }

    /** 获取投影半径 */
    getProjectionRadius(axis: Vec3) {
        return this.extents[0] * Math.abs(axis.dot(this.axes[0])) + this.extents[1] * Math.abs(axis.dot(this.axes[1]));
    }
}
