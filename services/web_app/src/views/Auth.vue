<script lang="ts" setup></script>

<template>
  <main>
    <div class="input-container">
      <!-- Transition wrapper for step changes -->
      <Transition name="fade" mode="out-in">
        <!-- Email input (step 1) -->
        <div key="email" class="input-wrapper">
          <input type="email" placeholder="Email" autofocus />
        </div>

        <!-- Passphrase input (step 2) -->
        <!-- <div key="passphrase" class="input-wrapper">
          <div class="input-container-relative">
            <input
              type="password"
              placeholder="Passphrase"
            />
            <div class="loading-pulse"></div>
          </div>
          <button class="back-button">
            ← Back
          </button>
        </div> -->
      </Transition>
    </div>
  </main>
</template>

<style scoped>
main {
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
}

.input-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  position: relative;
}

.input-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

input {
  width: 35rem;
  padding: 1rem 0;
  color: var(--color-foreground);
  font-size: 1.1rem;
  text-align: center;
  border: none;
  border-bottom: 0.1rem solid var(--color-accent);
  background-color: transparent;
  transition: border-bottom-color 0.2s ease;
}

input::placeholder {
  color: var(--color-accent);
}

input:focus {
  outline: none;
  border-bottom-color: var(--color-foreground);
}

input:disabled {
  cursor: not-allowed;
  color: var(--color-accent);
  opacity: 0.6;
  border-bottom-color: var(--color-accent);
}

/* Container for input and loading animation */
.input-container-relative {
  position: relative;
  width: 100%;
  display: flex;
  justify-content: center;
}

/* Loading pulse animation element */
.loading-pulse {
  position: absolute;
  bottom: -0.1rem;
  left: 50%;
  transform: translateX(-50%);
  width: 35rem;
  height: 0.1rem;
  background:
    linear-gradient(90deg, transparent 0%, var(--color-foreground) 50%, transparent 100%),
    linear-gradient(90deg, transparent 0%, var(--color-foreground) 50%, transparent 100%);
  background-size:
    40% 100%,
    40% 100%;
  background-position:
    -150% 0,
    -150% 0;
  background-repeat: no-repeat;
  animation: loading-pulse 2s ease-in-out infinite;
  pointer-events: none;
}

@keyframes loading-pulse {
  0% {
    background-position:
      -150% 0,
      -150% 0;
  }
  50% {
    background-position:
      250% 0,
      -150% 0;
  }
  100% {
    background-position:
      250% 0,
      250% 0;
  }
}

.back-button {
  background: none;
  border: none;
  color: var(--color-accent);
  font-size: 0.9rem;
  cursor: pointer;
  padding: 0.5rem;
  transition: color 0.2s ease;
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translate(-50%, 150%);
}

.back-button:hover {
  color: var(--color-foreground);
}

/* Fade transition for smooth step changes and status messages */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease-in-out;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
