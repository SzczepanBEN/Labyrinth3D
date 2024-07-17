import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls';

const LEVELS = 10;
const BASE_SIZE = 11;

const generateLabyrinth = (width, height) => {
  const lab = Array(height).fill().map(() => Array(width).fill(1));

  const carve = (x, y) => {
    lab[y][x] = 0;
    const directions = [[0, 1], [1, 0], [0, -1], [-1, 0]];
    directions.sort(() => Math.random() - 0.5);

    for (const [dx, dy] of directions) {
      const nx = x + dx * 2, ny = y + dy * 2;
      if (nx >= 0 && nx < width && ny >= 0 && ny < height && lab[ny][nx] === 1) {
        lab[y + dy][x + dx] = 0;
        carve(nx, ny);
      }
    }
  };

  carve(1, 1);
  lab[0][1] = 0;
  lab[height - 1][width - 2] = 2; // Exit
  return lab;
};

const LabyrinthGame3D = () => {
  const mountRef = useRef(null);
  const controlsRef = useRef(null);
  const [level, setLevel] = useState(1);
  const [time, setTime] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [showInstructions, setShowInstructions] = useState(true);
  const [gameStarted, setGameStarted] = useState(false);

  useEffect(() => {
    let scene, camera, renderer, controls;
    let maze;
    let animationId;
    let moveForward = false;
    let moveBackward = false;
    let moveLeft = false;
    let moveRight = false;

    const size = BASE_SIZE + (level - 1) * 2;
    const labyrinth = generateLabyrinth(size, size);

    const onKeyDown = (event) => {
      switch (event.code) {
        case 'KeyW': moveForward = true; break;
        case 'KeyS': moveBackward = true; break;
        case 'KeyA': moveLeft = true; break;
        case 'KeyD': moveRight = true; break;
        case 'Space':
          if (!gameStarted) {
            startGame();
          }
          break;
      }
    };

    const onKeyUp = (event) => {
      switch (event.code) {
        case 'KeyW': moveForward = false; break;
        case 'KeyS': moveBackward = false; break;
        case 'KeyA': moveLeft = false; break;
        case 'KeyD': moveRight = false; break;
      }
    };

    const checkCollision = () => {
      const playerPosition = controls.getObject().position;
      const mazeX = Math.round(playerPosition.x + size / 2);
      const mazeZ = Math.round(playerPosition.z + size / 2);

      return labyrinth[mazeZ] && labyrinth[mazeZ][mazeX] === 1;
    };

    const checkExit = () => {
      const playerPosition = controls.getObject().position;
      const mazeX = Math.round(playerPosition.x + size / 2);
      const mazeZ = Math.round(playerPosition.z + size / 2);

      if (labyrinth[mazeZ] && labyrinth[mazeZ][mazeX] === 2) {
        if (level === LEVELS) {
          setGameOver(true);
        } else {
          setLevel(prevLevel => prevLevel + 1);
        }
      }
    };

    const init = () => {
      scene = new THREE.Scene();
      scene.background = new THREE.Color(0x87CEEB);
      camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
      renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      mountRef.current.appendChild(renderer.domElement);

      const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
      scene.add(ambientLight);

      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
      directionalLight.position.set(size / 2, size, size / 2);
      directionalLight.castShadow = true;
      directionalLight.shadow.mapSize.width = 1024;
      directionalLight.shadow.mapSize.height = 1024;
      directionalLight.shadow.camera.near = 1;
      directionalLight.shadow.camera.far = size * 2;
      scene.add(directionalLight);

      controls = new PointerLockControls(camera, renderer.domElement);
      controlsRef.current = controls;
      scene.add(controls.getObject());

      maze = new THREE.Group();
      const wallGeometry = new THREE.BoxGeometry(1, 2, 1);
      const wallMaterial = new THREE.MeshPhongMaterial({ color: 0x8B4513 });
      const floorGeometry = new THREE.PlaneGeometry(1, 1);
      const floorMaterial = new THREE.MeshPhongMaterial({ color: 0x228B22 });
      const exitMaterial = new THREE.MeshPhongMaterial({ color: 0xFFD700 });

      const ceilingGeometry = new THREE.PlaneGeometry(size, size);
      const ceilingMaterial = new THREE.MeshPhongMaterial({ color: 0x4682B4 });
      const ceiling = new THREE.Mesh(ceilingGeometry, ceilingMaterial);
      ceiling.position.set(0, 2, 0);
      ceiling.rotation.x = Math.PI / 2;
      maze.add(ceiling);

      for (let i = 0; i < size; i++) {
        for (let j = 0; j < size; j++) {
          if (labyrinth[i][j] === 1) {
            const wall = new THREE.Mesh(wallGeometry, wallMaterial);
            wall.position.set(j - size / 2, 1, i - size / 2);
            wall.castShadow = true;
            wall.receiveShadow = true;
            maze.add(wall);
          } else {
            const floor = new THREE.Mesh(floorGeometry, labyrinth[i][j] === 2 ? exitMaterial : floorMaterial);
            floor.rotation.x = -Math.PI / 2;
            floor.position.set(j - size / 2, 0, i - size / 2);
            floor.receiveShadow = true;
            maze.add(floor);
          }
        }
      }
      scene.add(maze);

      camera.position.set(1 - size / 2, 1, -size / 2);
    };

    init();

    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);

    const animate = () => {
      animationId = requestAnimationFrame(animate);

      if (gameStarted) {
        const speed = 0.05;
        const oldPosition = controls.getObject().position.clone();

        if (moveForward) controls.moveForward(speed);
        if (moveBackward) controls.moveForward(-speed);
        if (moveLeft) controls.moveRight(-speed);
        if (moveRight) controls.moveRight(speed);

        if (checkCollision()) {
          controls.getObject().position.copy(oldPosition);
        }
        checkExit();
      }

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animationId);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
      if (mountRef.current) {
        mountRef.current.removeChild(renderer.domElement);
      }
    };
  }, [level, gameStarted]);

  useEffect(() => {
    let timer;
    if (gameStarted && !gameOver) {
      timer = setInterval(() => setTime(t => t + 1), 1000);
    }
    return () => clearInterval(timer);
  }, [gameStarted, gameOver]);

  const startGame = () => {
    setShowInstructions(false);
    setGameStarted(true);
    if (controlsRef.current) {
      controlsRef.current.lock();
    }
  };

  const handleCanvasClick = () => {
    if (!gameStarted) {
      startGame();
    } else if (controlsRef.current && !controlsRef.current.isLocked) {
      controlsRef.current.lock();
    }
  };

  return (
    <div className="relative w-full h-screen">
      <div ref={mountRef} className="w-full h-full" onClick={handleCanvasClick} />
      {/* Larger crosshair */}
      <div className="fixed top-1/2 left-1/2 w-4 h-4 bg-white rounded-full transform -translate-x-1/2 -translate-y-1/2 pointer-events-none" style={{ boxShadow: '0 0 0 2px black' }} />
      {showInstructions && (
        <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white p-6 rounded-lg text-center">
            <h2 className="text-2xl font-bold mb-4">3D Labyrinth Game</h2>
            <p className="mb-4">Use WASD keys to move. Mouse to look around.</p>
            <p className="mb-4">Click on the game or press Space to start.</p>
          </div>
        </div>
      )}
      {/* HUD */}
      <div className="absolute top-4 left-4 text-white text-xl font-bold">
        <p>Level: {level}</p>
        <p>Time: {time}s</p>
      </div>
      {!gameStarted && !showInstructions && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-white text-2xl font-bold">
          Click or Press Space to Start
        </div>
      )}
      {gameOver && (
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white p-4 rounded shadow">
          <h2 className="text-xl font-bold mb-2">Congratulations!</h2>
          <p>You've completed all {LEVELS} levels in {time} seconds!</p>
        </div>
      )}
    </div>
  );
};

export default LabyrinthGame3D;