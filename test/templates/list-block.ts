const dependencies = {
/// LIST
  "react": "^18.0.0"
/// IF context.includeRouter
  "react-router": "^6.0.0"
/// ENDIF
  "lodash": "^4.17.21"
/// IF context.includeRedux
  "redux": "^4.2.0"
/// ENDIF
/// ENDLIST
};

const items = [
/// LIST
  'item1'
/// IF context.hasItem2
  'item2'
/// ENDIF
  'item3'
/// ENDLIST
];
