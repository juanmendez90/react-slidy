const LINEAR_ANIMATION = 'linear'
const VALID_SWIPE_DISTANCE = 50
const TRANSITION_END = 'transitionend'
const {abs} = Math

function translate(to, moveX) {
  return moveX
    ? `translate3d(calc(-${to * 100}% - ${moveX}px), 0, 0)`
    : `translate3d(-${to * 100}%, 0, 0)`
}

function checkIsScrolling(isScrolling, isScrollBlocked, deltaX, deltaY) {
  const absDeltaY = abs(deltaY)
  return (
    isScrolling === true ||
    (isScrollBlocked === false && absDeltaY >= 0 && absDeltaY >= abs(deltaX))
  )
}

function clampNumber(x, minValue, maxValue) {
  return Math.min(Math.max(x, minValue), maxValue)
}

function getTouchCoordinatesFromEvent(e) {
  const {pageX, pageY} = e.targetTouches ? e.targetTouches[0] : e.touches[0]
  return {pageX, pageY}
}

function getTranslationCSS(duration, ease, index, x) {
  const easeCssText = ease !== '' ? `transition-timing-function: ${ease};` : ''
  const durationCssText = duration ? `transition-duration: ${duration}ms;` : ''
  return `${easeCssText}${durationCssText}transform: ${translate(index, x)};`
}

function cleanContainer(container) {
  // remove all the elements except the last one as it seems to be old data in the HTML
  // that's specially useful for dynamic content
  while (container.childElementCount > 1) {
    container !== null && container.removeChild(container.lastChild)
  }
  // tell that the clean is done
  return true
}

export default function slidy(containerDOMEl, options) {
  const {
    doAfterSlide,
    doBeforeSlide,
    ease,
    initialSlide,
    onNext,
    onPrev,
    slidesDOMEl,
    slideSpeed
  } = options
  let {items} = options

  // if frameDOMEl is null, then we do nothing
  if (containerDOMEl === null) return

  // initialize some variables
  let index = initialSlide
  let isScrolling = false
  let isScrollBlocked = false
  let transitionEndCallbackActivated = false

  // event handling
  let deltaX = 0
  let deltaY = 0
  let touchOffsetX = 0
  let touchOffsetY = 0

  /**
   * translates to a given position in a given time in milliseconds
   *
   * @duration  {number} time in milliseconds for the transistion
   * @ease      {string} easing css property
   * @x         {number} Number of pixels to fine tuning translation
   */
  function _translate(duration, ease = '', x = false) {
    const cssText = getTranslationCSS(duration, ease, index, x)
    slidesDOMEl.style.cssText = cssText
  }

  /**
   * slide function called by prev, next & touchend
   *
   * determine nextIndex and slide to next postion
   * under restrictions of the defined options
   *
   * @direction  {boolean} 'true' for right, 'false' for left
   */
  function slide(direction) {
    const movement = direction === true ? 1 : -1
    let duration = slideSpeed

    // calculate the nextIndex according to the movement
    let nextIndex = index + 1 * movement

    // nextIndex should be between 0 and items minus 1
    nextIndex = clampNumber(nextIndex, 0, items - 1)

    // if the nextIndex and the current is the same, we don't need to do the slide
    if (nextIndex === index) return

    // if the nextIndex is possible according to number of items, then use it
    if (nextIndex <= items) {
      // execute the callback from the options before sliding
      doBeforeSlide({currentSlide: index, nextSlide: nextIndex})
      // execute the internal callback
      direction ? onNext(nextIndex) : onPrev(nextIndex)
      index = nextIndex
    }

    // translate to the next index by a defined duration and ease function
    _translate(duration, ease)

    // execute the callback from the options after sliding
    slidesDOMEl.addEventListener(TRANSITION_END, function cb(e) {
      doAfterSlide({currentSlide: index})
      e.currentTarget.removeEventListener(e.type, cb)
    })
  }

  function _removeTouchEventsListeners(all = false) {
    containerDOMEl.removeEventListener('touchmove', onTouchmove)
    containerDOMEl.removeEventListener('touchend', onTouchend)
    containerDOMEl.removeEventListener('touchcancel', onTouchend)

    if (all === true) {
      containerDOMEl.removeEventListener('touchstart', onTouchstart)
    }
  }

  function _removeAllEventsListeners() {
    _removeTouchEventsListeners(true)
    slidesDOMEl.removeEventListener(TRANSITION_END, onTransitionEnd)
  }

  function onTransitionEnd() {
    if (transitionEndCallbackActivated === true) {
      _translate(0)
      transitionEndCallbackActivated = false
    }
  }

  function onTouchstart(e) {
    const coords = getTouchCoordinatesFromEvent(e)
    touchOffsetX = coords.pageX
    touchOffsetY = coords.pageY
    containerDOMEl.addEventListener('touchmove', onTouchmove)
    containerDOMEl.addEventListener('touchend', onTouchend, {passive: true})
    containerDOMEl.addEventListener('touchcancel', onTouchend, {passive: true})
  }

  function onTouchmove(e) {
    const coords = getTouchCoordinatesFromEvent(e)
    deltaX = coords.pageX - touchOffsetX
    deltaY = coords.pageY - touchOffsetY
    isScrolling = checkIsScrolling(isScrolling, isScrollBlocked, deltaX, deltaY)

    if (isScrolling === false && deltaX !== 0) {
      isScrollBlocked = true
      _translate(0, LINEAR_ANIMATION, deltaX * -1)
    }

    if (isScrollBlocked === true && e.cancelable) {
      e.preventDefault()
    }
  }

  function onTouchend(event) {
    if (isScrolling === false) {
      /**
       * is valid if:
       * -> swipe distance is greater than the specified valid swipe distance
       * -> swipe distance is more then a third of the swipe area
       * @isValidSlide {Boolean}
       */
      const isValid = abs(deltaX) > VALID_SWIPE_DISTANCE

      /**
       * is out of bounds if:
       * -> index is 0 and deltaX is greater than 0
       * -> index is the last slide and deltaX is smaller than 0
       * @isOutOfBounds {Boolean}
       */
      const direction = deltaX < 0
      const isOutOfBounds =
        (direction === false && index === 0) ||
        (direction === true && index === items - 1)

      if (isValid === true && isOutOfBounds === false) {
        slide(direction)
      } else {
        _translate(slideSpeed, LINEAR_ANIMATION)
      }
    }

    // reset variables with the initial values
    deltaX = deltaY = touchOffsetX = touchOffsetY = 0
    isScrolling = isScrollBlocked = false

    _removeTouchEventsListeners()
  }

  /**
   * public
   * setup function
   */
  function _setup() {
    slidesDOMEl.addEventListener(TRANSITION_END, onTransitionEnd, {
      passive: true
    })
    containerDOMEl.addEventListener('touchstart', onTouchstart, {passive: true})

    if (index !== 0) {
      _translate(0)
    }
  }

  /**
   * public
   * clean content of the slider
   */
  function clean() {
    return cleanContainer(slidesDOMEl)
  }

  /**
   * public
   * prev function: called on clickhandler
   */
  function prev(e) {
    e.preventDefault()
    e.stopPropagation()
    slide(false)
  }

  /**
   * public
   * next function: called on clickhandler
   */
  function next(e) {
    e.preventDefault()
    e.stopPropagation()
    slide(true)
  }

  /**
   * public
   * @param {number} newItems Number of items in the slider for dynamic content
   */
  function updateItems(newItems) {
    items = newItems
  }

  /**
   * public
   * destroy function: called to gracefully destroy the slidy instance
   */
  function destroy() {
    _removeAllEventsListeners()
  }

  // trigger initial setup
  _setup()

  // expose public api
  return {
    clean,
    destroy,
    next,
    prev,
    slide,
    updateItems
  }
}
