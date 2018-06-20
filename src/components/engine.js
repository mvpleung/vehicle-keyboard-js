module.exports = (function() {
  'use strict';

  //////

  let Chain = {
    create: function(defVal) {
      let chain = {};
      let _handlers = new Array();
      let _index = 0;

      chain.next = function(args) {
        if (_index <= _handlers.length) {
          return _handlers[_index++](chain, args);
        }
        return defVal;
      };

      chain.process = function(args) {
        let ret = chain.next(args);
        _index = 0;
        return ret;
      };

      chain.reg = function(h) {
        _handlers.push(h);
        return chain;
      };

      return chain;
    }
  };

  let Each = {
    create: function() {
      let _convertor = {};
      let _workers = new Array();

      _convertor.process = function(defVal, args) {
        let ret = defVal;
        _workers.forEach(function(worker) {
          ret = worker(ret, args);
        });
        return ret;
      };

      _convertor.reg = function(p) {
        _workers.push(p);
        return _convertor;
      };

      return _convertor;
    }
  };

  let Cached = {
    _mcached: {},

    reg: function(layout, category, keys) {
      if (keys !== undefined && keys.constructor === Array) {
        let cached = this._mcached;
        keys.forEach(function(key) {
          cached[category + ':' + key] = layout;
        });
      } else {
        let keyIdx = keys === undefined ? 0 : keys;
        this._mcached[category + ':' + keyIdx] = layout;
      }
    },

    load: function(category, key) {
      return this._mcached[category + ':' + (key === undefined ? 0 : key)];
    }
  };

  /**
   * 键盘类型
   */
  let KB_TYPES = {
    // 全键盘
    FULL: 0,
    // 民用
    CIVIL: 1,
    // 民用+特殊车辆
    CIVIL_SPEC: 2
  };

  /**
   * 键位功能类型
   */
  let KEY_TYPES = {
    // 普通按键
    GENERAL: 0,
    // 功能键：删除
    FUN_DEL: 1,
    // 功能键：确定
    FUN_OK: 2,
    // 功能键：更多
    FUN_MORE: 3
  };

  /**
   * 车牌号码类型
   */
  let NUM_TYPES = {
    // 未知类型
    UNKNOWN: -1,
    // 自动探测试
    AUTO_DETECT: 0,
    // 民用车牌
    CIVIL: 1,
    // 2007武警
    WJ2007: 2,
    // 2012武警
    WJ2012: 3,
    // 2012军队车牌
    PLA2012: 4,
    // 新能源车牌
    NEW_ENERGY: 5,
    // 2007大使馆车牌
    SHI2007: 6,
    // 2017新大使馆车牌
    SHI2017: 7,
    // 民航摆渡车
    AVIATION: 8,

    nameOf: function(mode) {
      switch (mode) {
        case -1:
          return 'UNKNOWN';
        case 0:
          return 'AUTO_DETECT';
        case 1:
          return 'CIVIL';
        case 2:
          return 'WJ2007';
        case 3:
          return 'WJ2012';
        case 4:
          return 'PLA2012';
        case 5:
          return 'NEW_ENERGY';
        case 6:
          return 'SHI2007';
        case 7:
          return 'SHI2017';
        case 8:
          return 'AVIATION';
        default:
          return 'UNKNOWN';
      }
    },

    lenOf: function(mode) {
      switch (mode) {
        case 3 /*2012武警*/:
        case 5 /*新能源*/:
          return 8;
        default:
          return 7;
      }
    }
  };

  let _STR_CIVIL_PVS =
    '京津沪晋冀蒙辽吉黑苏浙皖闽赣鲁豫鄂湘粤桂琼渝川贵云藏陕甘青宁新';
  let _STR_ARMY_PVS = 'QVKHBSLJNGCEZ';
  let _STR_ARMY_AREA = 'ABCDEFGHJKLMNOPRSTUVXY';
  let _STR_NUM = '1234567890';
  let _STR_LETTERS = 'QWERTYUPASDFGHJKLZXCVBNM';
  let _STR_CHARS = _STR_NUM + _STR_LETTERS;
  let _CHAR_EMBASSY = '使';
  let _CHAR_HK = '港';
  let _CHAR_MACAO = '澳';
  let _CHAR_XUE = '学';
  let _CHAR_JING = '警';
  let _CHAR_MIN = '民';
  let _CHAR_HANG = '航';
  let _STR_POSTFIX_ZH = _CHAR_JING + '挂领试超';
  let _CHAR_W = 'W';
  let _CHAR_J = 'J';
  let _CHAR_O = 'O';
  let _STR_DF = 'DF';
  let _STR_123 = '123';
  let _STR_Q_IOP = 'QWERTYUIOP';
  let _STR_Q_OP = 'QWERTYUOP';
  let _STR_Q_P = 'QWERTYUP';
  let _STR_A_L = 'ASDFGHJKL';
  let _STR_Z_M = 'ZXCVBNM';
  let _STR_HK_MACAO = _CHAR_HK + _CHAR_MACAO;
  let _STR_EMBASSY_PVS = _CHAR_EMBASSY + _STR_123;
  let _CHAR_DEL = '-';
  let _STR_DEL_OK = _CHAR_DEL + '+';

  /////////

  /**
   * 构建一个KeyEntity
   * @param {*text} 键位文本
   * @param {*keyCode} 按键码
   * @param {*enabled} 是否启用状态
   */
  function _keyOf(text, keyCode, enabled) {
    return {
      text: text, // 键位文字
      keyCode: keyCode === undefined ? KEY_TYPES.GENERAL : keyCode, // 键位功能类型代码，默认：普通键位
      enabled: enabled === undefined ? true : enabled, // 是否可用，默认：启用
      isFunKey: keyCode === undefined ? false : keyCode !== KEY_TYPES.GENERAL // 是否为功能键
    };
  }

  /**
   * 修改和创建一个新的KeyEntity，指定是否启用状态。
   * @param {*entity} 原KeyEntity
   * @param {*enabled} 是否启用状态
   */
  function _keyOfEnabled(entity, enabled) {
    return _keyOf(
      entity.text,
      entity.keyCode,
      enabled // 修改
    );
  }

  /** 将字符串转换成KeyEntity */
  function _keysOf(str) {
    let output = new Array();
    for (let i = 0; i < str.length; i++) {
      output.push(_keyOf(str[i]));
    }
    return output;
  }

  /** 修改和创建一个新的KeyEntity，指定功能键盘参数 */
  function _keyOfCode(entity, text, keyCode) {
    return _keyOf(
      text,
      keyCode, // 修改
      entity.enabled
    );
  }

  function _in(src, item) {
    return src.indexOf(item) >= 0;
  }

  function _isProvince(str) {
    return _in(_STR_CIVIL_PVS, str);
  }

  /** 探测车牌号码的模式 */
  function detectNumberTypeOf(presetNumber) {
    if (presetNumber.length === 0) {
      return NUM_TYPES.AUTO_DETECT;
    }
    let first = presetNumber.charAt(0);
    if (_in(_STR_ARMY_PVS, first)) {
      return NUM_TYPES.PLA2012;
    } else if (_CHAR_EMBASSY === first) {
      return NUM_TYPES.SHI2007;
    } else if (_CHAR_MIN === first) {
      return NUM_TYPES.AVIATION;
    } else if (_in(_STR_123, first)) {
      return NUM_TYPES.SHI2017;
    } else if (_CHAR_W === first) {
      if (presetNumber.length >= 3 && _isProvince(presetNumber.charAt(2))) {
        return NUM_TYPES.WJ2012;
      }
      return NUM_TYPES.WJ2007;
    } else if (_isProvince(first)) {
      if (presetNumber.length === 8) {
        // 新能源车牌：
        if (/\W[A-Z][0-9DF][0-9A-Z]\d{3}[0-9DF]/.test(presetNumber)) {
          return NUM_TYPES.NEW_ENERGY;
        }
        return NUM_TYPES.UNKNOWN;
      }
      return NUM_TYPES.CIVIL;
    }
    return NUM_TYPES.UNKNOWN;
  }

  /** 全局配置 */
  let _GlobalConf = {
    // 键位提供器
    keyProvider: Chain.create({}),
    // 布局提供器
    layoutProvider: Chain.create({}),
    // 布局混合
    mixiner: Each.create()
  };

  ////// 注册布局提供器 START //////

  // 民用键盘布局：
  let _LAYOUT_CIVIL = 'layout.c';
  Cached.reg(
    {
      row0: _keysOf(_STR_CIVIL_PVS.substr(0, 9)), // 京津沪晋冀蒙辽吉黑
      row1: _keysOf(_STR_CIVIL_PVS.substr(9, 9)), // 苏浙皖闽赣鲁豫鄂湘
      row2: _keysOf(_STR_CIVIL_PVS.substr(18, 9)), // 粤桂琼渝川贵云藏陕
      row3: _keysOf(_STR_CIVIL_PVS.substr(27, 4) + ' ' + ' ' + _STR_DEL_OK) // 甘青宁新-+ （不够9位补齐九位）
    },
    _LAYOUT_CIVIL,
    0
  );
  Cached.reg(
    {
      row0: _keysOf(_STR_NUM),
      row1: _keysOf(_STR_Q_OP + _CHAR_MACAO),
      row2: _keysOf(_STR_A_L + _CHAR_HK),
      row3: _keysOf(_STR_Z_M + _STR_DEL_OK)
    },
    _LAYOUT_CIVIL,
    1
  );
  Cached.reg(
    {
      row0: _keysOf(_STR_NUM),
      row1: _keysOf(_STR_Q_P + _STR_HK_MACAO),
      row2: _keysOf(_STR_A_L + _CHAR_XUE),
      row3: _keysOf(_STR_Z_M + _STR_DEL_OK)
    },
    _LAYOUT_CIVIL,
    [2, 3, 4, 5, 6, 7]
  );

  // 民用+特殊车牌布局：
  let _LAYOUT_SPEC = 'layout.s';
  let _LAYOUT_SPEC_FULL = 'layout.s.f';
  Cached.reg(
    {
      row0: _keysOf(_STR_CIVIL_PVS.substr(0, 9)), // "京津沪晋冀蒙辽吉黑"
      row1: _keysOf(_STR_CIVIL_PVS.substr(9, 9)), // "苏浙皖闽赣鲁豫鄂湘"
      row2: _keysOf(_STR_CIVIL_PVS.substr(18, 9)), // "粤桂琼渝川贵云藏"
      row3: _keysOf(
        _STR_CIVIL_PVS.substr(25, 5) + _CHAR_EMBASSY + _CHAR_W + _STR_DEL_OK
      ) // 陕甘青宁新使W-+
    },
    _LAYOUT_SPEC,
    0
  );
  Cached.reg(
    {
      row0: _keysOf(_STR_NUM + _STR_CIVIL_PVS.substr(0, 1)),
      row1: _keysOf(_STR_CIVIL_PVS.substr(1, 11)),
      row2: _keysOf(_STR_CIVIL_PVS.substr(12, 11)),
      row3: _keysOf(_STR_CIVIL_PVS.substr(22, 8) + _STR_DEL_OK)
    },
    _LAYOUT_SPEC,
    2
  );

  Cached.reg(
    {
      row0: _keysOf(_STR_NUM + _STR_CIVIL_PVS.substr(0, 1)),
      row1: _keysOf(_STR_CIVIL_PVS.substr(1, 11)),
      row2: _keysOf(_STR_CIVIL_PVS.substr(12, 10)),
      row3: _keysOf(_STR_CIVIL_PVS.substr(22, 9) + _CHAR_DEL)
    },
    _LAYOUT_SPEC_FULL,
    2
  );

  // 全键盘布局：
  let _LAYOUT_FULL = 'layout.f';
  Cached.reg(
    {
      row0: _keysOf(_STR_CIVIL_PVS.substr(0, 10)), // "京津沪晋冀蒙辽吉黑苏"
      row1: _keysOf(_STR_CIVIL_PVS.substr(10, 10)), // "浙皖闽赣鲁豫鄂湘粤桂"
      row2: _keysOf(_STR_CIVIL_PVS.substr(20, 10)), // "琼渝川贵云藏陕甘青宁"
      row3: _keysOf(
        _STR_CIVIL_PVS.substr(30, 1) +
          _CHAR_MIN +
          _STR_EMBASSY_PVS +
          _CHAR_W +
          _STR_ARMY_PVS.substr(0, 4)
      ), // 新民使123WQVKH
      row4: _keysOf(_STR_ARMY_PVS.substr(4, 9) + _CHAR_DEL)
    },
    _LAYOUT_FULL,
    0
  );
  Cached.reg(
    {
      row0: _keysOf(_STR_NUM),
      row1: _keysOf(_STR_Q_IOP),
      row2: _keysOf(_STR_A_L),
      row3: _keysOf(_STR_Z_M + _CHAR_XUE + _CHAR_HANG),
      row4: _keysOf(_STR_HK_MACAO + _STR_POSTFIX_ZH + _CHAR_EMBASSY + _CHAR_DEL)
    },
    _LAYOUT_FULL,
    1
  );
  Cached.reg(
    {
      row0: _keysOf(_STR_NUM),
      row1: _keysOf(_STR_Q_IOP),
      row2: _keysOf(_STR_A_L),
      row3: _keysOf(_STR_Z_M + _CHAR_XUE),
      row4: _keysOf(_STR_HK_MACAO + _STR_POSTFIX_ZH + _CHAR_EMBASSY + _CHAR_DEL)
    },
    _LAYOUT_FULL,
    [2, 3, 4, 5, 6, 7]
  );

  // 处理“民用+武警”的特殊键位2种情况:
  // 1 - 第一位键盘布局中，显示带武警字符的特殊布局:
  _GlobalConf.layoutProvider.reg(function(chain, args) {
    if (0 === args.index && args.keyboardType === KB_TYPES.CIVIL_SPEC) {
      return Cached.load(_LAYOUT_SPEC, 0);
    }
    return chain.next(args);
  });

  // 2 - 第二位键盘布局中，当输入的车牌为武警车牌时，才显示武警特殊布局:
  _GlobalConf.layoutProvider.reg(function(chain, args) {
    if (
      2 === args.index &&
      args.keyboardType !== KB_TYPES.CIVIL &&
      (NUM_TYPES.WJ2007 === args.numberType ||
        NUM_TYPES.WJ2012 === args.numberType)
    ) {
      if (args.keyboardType === KB_TYPES.FULL) {
        return Cached.load(_LAYOUT_SPEC_FULL, 2);
      }
      return Cached.load(_LAYOUT_SPEC, 2);
    }
    return chain.next(args);
  });

  // 其它注册布局提供器
  _GlobalConf.layoutProvider.reg(function(chain, args) {
    if (args.keyboardType === KB_TYPES.FULL) {
      return Cached.load(_LAYOUT_FULL, args.index);
    }
    return Cached.load(_LAYOUT_CIVIL, args.index);
  });

  ////// 注册布局提供器 END //////

  ////// 可用键位提供器 START //////

  let _KEY_ANY = 'keys.any';
  let _KEY_CIVIL = 'keys.civil';
  let _KEY_PLA2012 = 'keys.army';
  let _KEY_WJ = 'keys.wj';
  let _KEY_AVIATION = 'keys.aviation';
  let _KEY_SHI2007 = 'keys.embassy';
  let _KEY_SHI2007_ZH = 'keys.embassy.zh';
  let _KEY_NUMBRICS = 'keys.num';
  let _KEY_NUMBRICS_LETTERS = 'keys.num.letters';
  let _KEY_O_POLICE = 'keys.O.police';
  let _KEY_NUMERICS_DF = 'keys.num.df';
  let _KEY_HK_MACAO = 'keys.hk.macao';
  let _KEY_POSTFIX = 'keys.postfix';

  Cached.reg(
    _keysOf(
      _STR_CIVIL_PVS + _STR_EMBASSY_PVS + _CHAR_W + _STR_ARMY_PVS + _CHAR_MIN
    ),
    _KEY_ANY
  );
  Cached.reg(_keysOf(_STR_NUM), _KEY_NUMBRICS);
  Cached.reg(_keysOf(_STR_CHARS), _KEY_NUMBRICS_LETTERS);
  Cached.reg(_keysOf(_STR_CHARS + _CHAR_JING), _KEY_O_POLICE);

  Cached.reg(_keysOf(_STR_LETTERS + _CHAR_O), _KEY_CIVIL, 1);
  Cached.reg(_keysOf(_STR_ARMY_AREA), _KEY_PLA2012, 1);
  Cached.reg(_keysOf(_STR_123), _KEY_SHI2007, 1);
  Cached.reg(_keysOf(_CHAR_J), _KEY_WJ, 1);
  Cached.reg(_keysOf(_CHAR_HANG), _KEY_AVIATION, 1);

  Cached.reg(_keysOf(_STR_NUM + _STR_CIVIL_PVS), _KEY_WJ, 2);

  Cached.reg(_keysOf(_STR_NUM + _STR_DF), _KEY_NUMERICS_DF);
  Cached.reg(_keysOf(_STR_HK_MACAO), _KEY_HK_MACAO);
  Cached.reg(_keysOf(_STR_CHARS + _STR_POSTFIX_ZH + _CHAR_XUE), _KEY_POSTFIX);
  Cached.reg(_keysOf(_CHAR_EMBASSY), _KEY_SHI2007_ZH);

  // 注册键位提供器，序号：0
  _GlobalConf.keyProvider.reg(function(chain, args) {
    if (0 === args.index) {
      return Cached.load(_KEY_ANY);
    }
    return chain.next(args);
  });

  // 注册键位提供器，序号：1
  _GlobalConf.keyProvider.reg(function(chain, args) {
    if (1 === args.index) {
      switch (args.numberType) {
        case NUM_TYPES.PLA2012:
          return Cached.load(_KEY_PLA2012, 1);
        case NUM_TYPES.WJ2007:
        case NUM_TYPES.WJ2012:
          return Cached.load(_KEY_WJ, 1);
        case NUM_TYPES.AVIATION:
          return Cached.load(_KEY_AVIATION, 1);
        case NUM_TYPES.SHI2007:
          return Cached.load(_KEY_SHI2007, 1);
        case NUM_TYPES.SHI2017:
          return Cached.load(_KEY_NUMBRICS);
        default:
          return Cached.load(_KEY_CIVIL, 1);
      }
    } else {
      return chain.next(args);
    }
  });

  // 注册键位提供器，序号：2
  _GlobalConf.keyProvider.reg(function(chain, args) {
    if (2 === args.index) {
      switch (args.numberType) {
        case NUM_TYPES.WJ2007:
        case NUM_TYPES.WJ2012:
          return Cached.load(_KEY_WJ, 2);
        case NUM_TYPES.SHI2007:
        case NUM_TYPES.SHI2017:
          return Cached.load(_KEY_NUMBRICS);
        case NUM_TYPES.NEW_ENERGY:
          return Cached.load(_KEY_NUMERICS_DF);
        default:
          return Cached.load(_KEY_NUMBRICS_LETTERS);
      }
    } else {
      return chain.next(args);
    }
  });

  // 注册键位提供器，序号：3
  _GlobalConf.keyProvider.reg(function(chain, args) {
    if (3 === args.index && NUM_TYPES.SHI2007 === args.numberType) {
      return Cached.load(_KEY_NUMBRICS);
    }
    return chain.next(args);
  });

  // 注册键位提供器，序号：4
  _GlobalConf.keyProvider.reg(function(chain, args) {
    if (
      (4 === args.index || 5 === args.index) &&
      NUM_TYPES.NEW_ENERGY === args.numberType
    ) {
      return Cached.load(_KEY_NUMBRICS);
    }
    return chain.next(args);
  });

  // 注册键位提供器，序号：6
  _GlobalConf.keyProvider.reg(function(chain, args) {
    if (6 === args.index) {
      let mode = args.numberType;
      switch (args.numberType) {
        case NUM_TYPES.NEW_ENERGY:
          return Cached.load(_KEY_NUMBRICS);
        case NUM_TYPES.PLA2012:
        case NUM_TYPES.SHI2007:
        case NUM_TYPES.WJ2007:
        case NUM_TYPES.AVIATION:
        case NUM_TYPES.WJ2012:
          return Cached.load(_KEY_NUMBRICS_LETTERS);
        case NUM_TYPES.SHI2017:
          return Cached.load(_KEY_SHI2007_ZH);
        default:
          let cityCode = args.number.charAt(1);
          // “粤O” 之类的警车号牌
          if ('O' === cityCode) {
            return Cached.load(_KEY_O_POLICE);
          }
          // “港澳”车牌
          let isHK_MACAO =
            NUM_TYPES.CIVIL === mode &&
            '粤' === args.number.charAt(0) &&
            'Z' === cityCode;
          if (isHK_MACAO) {
            return Cached.load(_KEY_HK_MACAO);
          }
          return Cached.load(_KEY_POSTFIX);
      }
    }
    return chain.next(args);
  });

  // 注册键位提供器，序号：7
  _GlobalConf.keyProvider.reg(function(chain, args) {
    if (7 === args.index && NUM_TYPES.NEW_ENERGY === args.numberType) {
      return Cached.load(_KEY_NUMERICS_DF);
    }
    return chain.next(args);
  });

  // 注册键位提供器，默认
  _GlobalConf.keyProvider.reg(function() {
    return Cached.load(_KEY_NUMBRICS_LETTERS);
  });

  ////// 可用键位提供器 END //////

  function _rowOf(obj, index) {
    let data = obj['row' + index];
    return data === undefined ? [] : data;
  }

  function _mapRow(obj, index, mapper) {
    obj['row' + index] = _rowOf(obj, index).map(mapper);
  }

  function _mapLayout(layout, mapper) {
    layout.numberType = layout.numberType;
    _mapRow(layout, 0, mapper);
    _mapRow(layout, 1, mapper);
    _mapRow(layout, 2, mapper);
    _mapRow(layout, 3, mapper);
    _mapRow(layout, 4, mapper);
    return layout;
  }

  // 注册键位可用性转换器
  _GlobalConf.mixiner.reg(function(layout, args) {
    let availables = args.keys.map(function(ele) {
      return ele.text;
    });
    return _mapLayout(layout, function(entity) {
      return _keyOfEnabled(entity, _in(availables, entity.text));
    });
  });

  // 禁用键位: 处理新能源键盘模式下，首位不允许出现的字符
  _GlobalConf.mixiner.reg(function(layout, args) {
    return _mapLayout(layout, function(entity) {
      let enabled = entity.enabled;
      if (
        enabled &&
        args.index === 0 &&
        layout.numberType === NUM_TYPES.NEW_ENERGY
      ) {
        enabled = _isProvince(entity.text);
      }
      return _keyOfEnabled(entity, enabled);
    });
  });

  // 功能按钮的转换处理
  _GlobalConf.mixiner.reg(function(layout) {
    return _mapLayout(layout, function(entity) {
      // 注意,KeyEntity的KeyCode还是原始状态,尚未更新,不能使用它来判断是否是功能键
      if ('-' === entity.text) {
        return _keyOfCode(entity, '' /* ← */, KEY_TYPES.FUN_DEL);
      } else if ('+' === entity.text) {
        return _keyOfCode(entity, '确定', KEY_TYPES.FUN_OK);
      }
      return entity;
    });
  });

  // 处理删除键逻辑
  _GlobalConf.mixiner.reg(function(layout) {
    // 当输入车牌不为空时可以点击
    return _mapLayout(layout, function(entity) {
      if (entity.keyCode === KEY_TYPES.FUN_DEL) {
        return _keyOfEnabled(entity, layout.numberLength !== 0);
      }
      return entity;
    });
  });

  // 处理确定键位的逻辑
  _GlobalConf.mixiner.reg(function(layout) {
    // 当输入车牌达到最后一位时可以点击
    return _mapLayout(layout, function(entity) {
      if (entity.keyCode === KEY_TYPES.FUN_OK) {
        return _keyOfEnabled(
          entity,
          layout.numberLength === layout.numberLimitLength
        );
      }
      return entity;
    });
  });

  // 合并生成keys字段
  _GlobalConf.mixiner.reg(function(layout) {
    layout.keys = _rowOf(layout, 0)
      .concat(_rowOf(layout, 1))
      .concat(_rowOf(layout, 2))
      .concat(_rowOf(layout, 3))
      .concat(_rowOf(layout, 4));
    return layout;
  });

  ////////

  function __clone(srcObj) {
    let newCopy = srcObj.constructor();
    for (let prop in srcObj) {
      if (srcObj.hasOwnProperty(prop)) {
        newCopy[prop] = srcObj[prop];
      }
    }
    return newCopy;
  }

  /**
   * @param {* keyboardType} 键盘类型 1，表示: 民用键盘
   * @param {* currentIndex} 当前键位序号
   * @param {* presetNumber} 预设车牌号码
   * @param {* numberType} 车牌号码类型 默认为0,表示自动探测版本类型。也可以指定为5,表示新能源车牌
   */
  function _update(options) {
    let { keyboardType, currentIndex, presetNumber, numberType } = options;
    // 检查参数
    if (
      keyboardType === undefined ||
      keyboardType < KB_TYPES.FULL ||
      keyboardType > KB_TYPES.CIVIL_SPEC
    ) {
      throw new RangeError(
        '参数(keyboardType)范围必须在[0, 2]之间，当前: ' + keyboardType
      );
    }
    if (
      currentIndex === undefined ||
      currentIndex !== parseInt(currentIndex, 10)
    ) {
      throw new TypeError('参数(currentIndex)必须为整数数值');
    }
    if (presetNumber === undefined || typeof presetNumber !== 'string') {
      throw new TypeError('参数(presetNumber)必须为字符串');
    }
    if (numberType === undefined || numberType !== parseInt(numberType, 10)) {
      throw new TypeError('参数(numberType)必须为整数数值');
    }
    var detectedNumberType = detectNumberTypeOf(presetNumber);
    // 如果预设车牌号码不为空，车牌类型为自动探测，则尝试
    var presetNumberType = numberType;
    if (presetNumber.length > 0 && numberType === NUM_TYPES.AUTO_DETECT) {
      presetNumberType = detectedNumberType;
    }
    let limitLength = NUM_TYPES.lenOf(presetNumberType);
    let presetLength = presetNumber.length;
    currentIndex = Math.min(currentIndex, limitLength - 1);
    if (presetLength > limitLength) {
      throw new RangeError(
        '参数(presetNumber)字符太长：' +
          presetNumber +
          '，车牌类型：' +
          numberType +
          '，此类型最大长度:' +
          limitLength
      );
    }
    let args = {
      index: currentIndex,
      number: presetNumber,
      keyboardType: keyboardType,
      numberType: presetNumberType
    };
    // 处理键位布局
    let output = __clone(_GlobalConf.layoutProvider.process(args));
    // 传递一些参数到外部
    output.index = args.index;
    output.presetNumber = args.number;
    output.keyboardType = args.keyboardType;
    output.numberType = args.numberType;
    output.presetNumberType = args.numberType;
    output.detectedNumberType = detectedNumberType;
    output.numberLength = presetLength;
    output.numberLimitLength = limitLength;
    // 处理键位
    args.keys = _GlobalConf.keyProvider.process(args);
    // 混合布局与键位
    return _GlobalConf.mixiner.process(output, args);
  }

  /**
   * 探测车牌类型
   * @param {String} presetNumber 车牌号
   * @param {Number} numberType 车牌类型
   */
  function _detectNumberType(presetNumber, numberType) {
    let detectedNumberType = detectNumberTypeOf(presetNumber);
    // 如果预设车牌号码不为空，车牌类型为自动探测，则尝试
    let presetNumberType = numberType;
    if (presetNumber.length > 0 && numberType === NUM_TYPES.AUTO_DETECT) {
      presetNumberType = detectedNumberType;
    }
    return presetNumberType;
  }

  // 导出的对象包括两个属性：update函数、全局配置
  let _export = {
    update: _update,
    config: _GlobalConf,
    detectNumberType: _detectNumberType
  };
  // 导出一些工具类函数
  _export.$newKey = _keyOf;
  // 导出一些数据类型
  _export.NUM_TYPES = NUM_TYPES;
  _export.KEY_TYPES = KEY_TYPES;
  _export.KEYBOARD_TYPES = KB_TYPES;
  _export.VERSION = 'R1.0/2017.1117/iRain(SZ)';

  return _export;
})();
