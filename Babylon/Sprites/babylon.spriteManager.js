﻿var BABYLON = BABYLON || {};

(function () {
    var appendSpriteVertex = function (sprite, vertices, offsetX, offsetY, rowSize, epsilon) {
        if (offsetX == 0)
            offsetX = epsilon;
        else if (offsetX == 1)
            offsetX = 1 - epsilon;
        
        if (offsetY == 0)
            offsetY = epsilon;
        else if (offsetY == 1)
            offsetY = 1 - epsilon;

        vertices.push(sprite.position.x);
        vertices.push(sprite.position.y);
        vertices.push(sprite.position.z);
        vertices.push(sprite.angle);
        vertices.push(sprite.size);
        vertices.push(offsetX);
        vertices.push(offsetY);
        vertices.push(sprite.invertU ? 1 : 0);
        vertices.push(sprite.invertV ? 1 : 0);
        var offset = (sprite.cellIndex / rowSize) >> 0;
        vertices.push(sprite.cellIndex - offset * rowSize);
        vertices.push(offset);
        // Color
        vertices.push(sprite.color.r);
        vertices.push(sprite.color.g);
        vertices.push(sprite.color.b);
        vertices.push(sprite.color.a);
    };

    BABYLON.SpriteManager = function (name, imgUrl, capacity, cellSize, scene, epsilon) {
        this.name = name;
        this._capacity = capacity;
        this.cellSize = cellSize;
        this._spriteTexture = new BABYLON.Texture(imgUrl, scene, true, false);
        this._spriteTexture.wrapU = false;
        this._spriteTexture.wrapV = false;
        this._epsilon = epsilon === undefined ? 0.01 : epsilon;

        this._scene = scene;
        this._scene.spriteManagers.push(this);
        
        // VBO
        this._vertexDeclaration = [3, 4, 4, 4];
        this._vertexStrideSize = 15 * 4; // 15 floats per sprite (x, y, z, angle, size, offsetX, offsetY, invertU, invertV, cellIndexX, cellIndexY, color)
        this._vertexBuffer = scene.getEngine().createDynamicVertexBuffer(capacity * this._vertexStrideSize * 4);

        var indices = [];
        var index = 0;
        for (var count = 0; count < capacity; count++) {
            indices.push(index);
            indices.push(index + 1);
            indices.push(index + 2);
            indices.push(index);
            indices.push(index + 2);
            indices.push(index + 3);
            index += 4;
        }

        this._indexBuffer = scene.getEngine().createIndexBuffer(indices);
        
        // Sprites
        this.sprites = [];
        
        // Effects
        this._effectBase = this._scene.getEngine().createEffect("sprites",
                    ["position", "options", "cellInfo", "color"],
                    ["view", "projection", "textureInfos", "alphaTest"],
                    ["diffuseSampler"], "");
        
        this._effectFog = this._scene.getEngine().createEffect("sprites",
                    ["position", "options", "cellInfo", "color"],
                    ["view", "projection", "textureInfos", "alphaTest", "vFogInfos", "vFogColor"],
                    ["diffuseSampler"], "#define FOG");
    };
    
    // Members
    BABYLON.SpriteManager.prototype.onDispose = null;

    // Methods
    BABYLON.SpriteManager.prototype.render = function() {
        // Check
        if (!this._effectBase.isReady() || !this._effectFog.isReady() || !this._spriteTexture || !this._spriteTexture.isReady())
            return 0;

        var engine = this._scene.getEngine();
        var baseSize = this._spriteTexture.getBaseSize();

        // Sprites
        var deltaTime = BABYLON.Tools.GetDeltaTime();
        var vertices = [];
        var max = Math.min(this._capacity, this.sprites.length);
        var rowSize = baseSize.width / this.cellSize;
        for (var index = 0; index < max; index++) {
            var sprite = this.sprites[index];

            sprite._animate(deltaTime);

            appendSpriteVertex(sprite, vertices, 0, 0, rowSize, this._epsilon);
            appendSpriteVertex(sprite, vertices, 1, 0, rowSize, this._epsilon);
            appendSpriteVertex(sprite, vertices, 1, 1, rowSize, this._epsilon);
            appendSpriteVertex(sprite, vertices, 0, 1, rowSize, this._epsilon);
        }
        engine.updateDynamicVertexBuffer(this._vertexBuffer, vertices);
       
        // Render
        var effect = this._effectBase;

        if (this._scene.fogMode !== BABYLON.Scene.FOGMODE_NONE) {
            effect = this._effectFog;
        }
        
        engine.enableEffect(effect);

        var viewMatrix = this._scene.getViewMatrix();
        effect.setTexture("diffuseSampler", this._spriteTexture);
        effect.setMatrix("view", viewMatrix);
        effect.setMatrix("projection", this._scene.getProjectionMatrix());

        effect.setVector2("textureInfos", this.cellSize / baseSize.width, this.cellSize / baseSize.height);
        
        // Fog
        if (this._scene.fogMode !== BABYLON.Scene.FOGMODE_NONE) {
            effect.setFloat4("vFogInfos", this._scene.fogMode, this._scene.fogStart, this._scene.fogEnd, this._scene.fogDensity);
            effect.setColor3("vFogColor", this._scene.fogColor);
        }

        // VBOs
        engine.bindBuffers(this._vertexBuffer, this._indexBuffer, this._vertexDeclaration, this._vertexStrideSize, effect);

        // Draw order
        effect.setBool("alphaTest", true);
        engine.setColorWrite(false);
        engine.draw(true, 0, max * 6);
        engine.setColorWrite(true);
        effect.setBool("alphaTest", false);
        
        engine.setAlphaMode(BABYLON.Engine.ALPHA_COMBINE);
        engine.draw(true, 0, max * 6);
        engine.setAlphaMode(BABYLON.Engine.ALPHA_DISABLE);
    };
    
    BABYLON.SpriteManager.prototype.dispose = function () {
        if (this._vertexBuffer) {
            //this._scene.getEngine()._releaseBuffer(this._vertexBuffer);
            this._vertexBuffer = null;
        }

        if (this._indexBuffer) {
            this._scene.getEngine()._releaseBuffer(this._indexBuffer);
            this._indexBuffer = null;
        }

        if (this._spriteTexture) {
            this._spriteTexture.dispose();
            this._spriteTexture = null;
        }

        // Remove from scene
        var index = this._scene.spriteManagers.indexOf(this);
        this._scene.spriteManagers.splice(index, 1);
        
        // Callback
        if (this.onDispose) {
            this.onDispose();
        }
    };
    
})();